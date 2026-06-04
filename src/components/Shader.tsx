import { useEffect, useRef, type CSSProperties } from "react";

/**
 * Cursor-reactive WebGL shader backdrop, ported from the reference
 * `shader.jsx`: a slow fbm noise field with a soft warm halo that eases toward
 * the cursor, plus a little grain. It is theme-aware (the reference is
 * dark-only) and paints a static gradient — never animating — when `disabled`
 * is set (reduce-motion / shader-off) or WebGL is unavailable.
 *
 * It only ever sits *behind* shell / empty / Feed-ambiance surfaces; never
 * behind terminals, the Board grid, or Cockpit tiles (visual-language.md).
 */
export function Shader({
  disabled,
  dark = true,
  subtle = false,
}: {
  disabled: boolean;
  dark?: boolean;
  subtle?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    // Static gradient fallback (reduce-motion / shader-off / no WebGL).
    if (disabled) {
      const ctx = canvas.getContext("2d");
      if (!ctx) return undefined;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const paint = () => {
        canvas.width = Math.max(1, canvas.clientWidth * dpr);
        canvas.height = Math.max(1, canvas.clientHeight * dpr);
        const gradient = ctx.createRadialGradient(
          canvas.width * 0.5,
          canvas.height * 0.3,
          0,
          canvas.width * 0.5,
          canvas.height * 0.3,
          canvas.width * 0.8,
        );
        if (dark) {
          gradient.addColorStop(0, "rgba(60,60,70,1)");
          gradient.addColorStop(0.5, "rgba(20,20,24,1)");
          gradient.addColorStop(1, "rgba(8,8,10,1)");
        } else {
          gradient.addColorStop(0, "rgba(246,247,250,1)");
          gradient.addColorStop(0.5, "rgba(235,237,241,1)");
          gradient.addColorStop(1, "rgba(226,228,233,1)");
        }
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      };
      paint();
      const observer = new ResizeObserver(paint);
      observer.observe(canvas);
      return () => observer.disconnect();
    }

    const gl = canvas.getContext("webgl", { antialias: false, alpha: false });
    if (!gl) {
      // No WebGL — leave the element transparent; the page background shows.
      return undefined;
    }

    const vertexSrc = `
      attribute vec2 a; varying vec2 vUv;
      void main(){ vUv = a*0.5+0.5; gl_Position = vec4(a,0.,1.); }
    `;
    const fragmentSrc = `
      precision highp float;
      varying vec2 vUv;
      uniform float uT;
      uniform vec2 uRes;
      uniform vec2 uMouse;
      uniform float uLight;

      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p){
        vec2 i = floor(p); vec2 f = fract(p);
        float a = hash(i), b = hash(i+vec2(1.,0.)), c = hash(i+vec2(0.,1.)), d = hash(i+vec2(1.,1.));
        vec2 u = f*f*(3.-2.*f);
        return mix(mix(a,b,u.x), mix(c,d,u.x), u.y);
      }
      float fbm(vec2 p){
        float v = 0.; float a = 0.5;
        for(int i=0;i<5;i++){ v += a*noise(p); p *= 2.07; a *= 0.5; }
        return v;
      }

      void main(){
        vec2 uv = vUv;
        vec2 p = uv * vec2(uRes.x/uRes.y, 1.0);
        vec2 m = uMouse * vec2(uRes.x/uRes.y, 1.0);

        float t = uT * 0.04;
        float n = fbm(p*2.2 + vec2(t, -t*0.7));
        n = pow(n, 1.4);

        float d = distance(p, m);
        float halo = exp(-d*2.6) * 0.65;

        vec3 darkLo = vec3(0.04,0.04,0.05);
        vec3 darkHi = vec3(0.18,0.18,0.20);
        vec3 liteLo = vec3(0.92,0.92,0.95);
        vec3 liteHi = vec3(0.82,0.83,0.87);
        vec3 lo = mix(darkLo, liteLo, uLight);
        vec3 hi = mix(darkHi, liteHi, uLight);
        vec3 base = mix(lo, hi, n);

        // Vignette on the greyscale base.
        float v = smoothstep(1.4, 0.2, length(uv-0.5));
        base *= mix(0.55 + 0.55*v, 0.86 + 0.14*v, uLight);

        // Saturated per-Project palette ambiance — the "alive" color. A cyan
        // halo eases toward the cursor; purple + magenta pools drift in the
        // field, modulated by the noise. Calmer on the light theme.
        float intensity = mix(0.62, 0.28, uLight);
        vec3 cCyan    = vec3(0.00, 0.85, 1.00);
        vec3 cPurple  = vec3(0.33, 0.09, 0.79);
        vec3 cMagenta = vec3(0.85, 0.27, 0.94);
        float bl = exp(-distance(uv, vec2(0.20, 0.26)) * 1.9);
        float tr = exp(-distance(uv, vec2(0.82, 0.74)) * 2.1);
        base += cCyan    * halo * intensity;
        base += cPurple  * bl * (0.35 + 0.30 * n) * intensity;
        base += cMagenta * tr * (0.30 + 0.30 * n) * intensity;

        float g = (hash(gl_FragCoord.xy + uT) - 0.5) * 0.012;
        gl_FragColor = vec4(base + g, 1.0);
      }
    `;

    const compile = (type: number, src: string) => {
      const shader = gl.createShader(type);
      if (!shader) return null;
      gl.shaderSource(shader, src);
      gl.compileShader(shader);
      return shader;
    };
    const program = gl.createProgram();
    const vs = compile(gl.VERTEX_SHADER, vertexSrc);
    const fs = compile(gl.FRAGMENT_SHADER, fragmentSrc);
    if (!program || !vs || !fs) return undefined;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    gl.useProgram(program);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const aLoc = gl.getAttribLocation(program, "a");
    gl.enableVertexAttribArray(aLoc);
    gl.vertexAttribPointer(aLoc, 2, gl.FLOAT, false, 0, 0);

    const uT = gl.getUniformLocation(program, "uT");
    const uRes = gl.getUniformLocation(program, "uRes");
    const uMouse = gl.getUniformLocation(program, "uMouse");
    const uLight = gl.getUniformLocation(program, "uLight");
    gl.uniform1f(uLight, dark ? 0 : 1);

    const dpr = Math.min(1.5, window.devicePixelRatio || 1); // throttle for the webview
    const resize = () => {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      canvas.width = Math.max(1, w * dpr);
      canvas.height = Math.max(1, h * dpr);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(uRes, canvas.width, canvas.height);
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);

    const mouse = { x: 0.5, y: 0.5, tx: 0.5, ty: 0.5 };
    const onMove = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      mouse.tx = (event.clientX - rect.left) / rect.width;
      mouse.ty = 1 - (event.clientY - rect.top) / rect.height;
    };
    window.addEventListener("pointermove", onMove);

    let raf = 0;
    const start = performance.now();
    const tick = () => {
      const t = (performance.now() - start) / 1000;
      mouse.x += (mouse.tx - mouse.x) * 0.06;
      mouse.y += (mouse.ty - mouse.y) * 0.06;
      gl.uniform1f(uT, t);
      gl.uniform2f(uMouse, mouse.x, mouse.y);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      raf = requestAnimationFrame(tick);
    };
    tick();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onMove);
      observer.disconnect();
      // Release GPU resources — this effect re-runs on theme/reduce-motion
      // toggles, so leaking here would accumulate orphaned shaders/buffers.
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
    };
  }, [disabled, dark]);

  return (
    <canvas
      // A canvas is locked to one context type for its lifetime — once it has a
      // WebGL context, getContext("2d") returns null (and vice-versa). Keying on
      // the mode remounts a fresh canvas when toggling shader on/off or theme,
      // so each mode gets a clean context.
      key={`${disabled ? "static" : "live"}-${dark ? "dark" : "light"}`}
      ref={canvasRef}
      className="shader-canvas"
      aria-hidden="true"
      style={{ opacity: subtle ? 0.55 : 1 } as CSSProperties}
    />
  );
}
