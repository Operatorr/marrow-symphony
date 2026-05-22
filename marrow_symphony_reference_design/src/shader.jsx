// Cursor-reactive WebGL shader backdrop.
// Greyscale + subtle warm tint near cursor. Disabled when prefers-reduced-motion.
// Kept small: one fullscreen quad, one fragment shader, no animation libs.

const Shader = (({ reduce }) => {
  const ref = React.useRef(null);
  const mouseRef = React.useRef({ x: 0.5, y: 0.5, tx: 0.5, ty: 0.5 });

  React.useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;

    if (reduce) {
      // Paint a static gradient when reduce-motion is on.
      const ctx = canvas.getContext('2d');
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const resize = () => {
        canvas.width = canvas.clientWidth * dpr;
        canvas.height = canvas.clientHeight * dpr;
        const g = ctx.createRadialGradient(
          canvas.width * 0.5, canvas.height * 0.3, 0,
          canvas.width * 0.5, canvas.height * 0.3, canvas.width * 0.8
        );
        g.addColorStop(0, 'rgba(60,60,70,1)');
        g.addColorStop(0.5, 'rgba(20,20,24,1)');
        g.addColorStop(1, 'rgba(8,8,10,1)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      };
      resize();
      const obs = new ResizeObserver(resize);
      obs.observe(canvas);
      return () => obs.disconnect();
    }

    const gl = canvas.getContext('webgl', { antialias: false, alpha: false });
    if (!gl) return;

    const vs = `
      attribute vec2 a; varying vec2 vUv;
      void main(){ vUv = a*0.5+0.5; gl_Position = vec4(a,0.,1.); }
    `;
    const fs = `
      precision highp float;
      varying vec2 vUv;
      uniform float uT;
      uniform vec2 uRes;
      uniform vec2 uMouse;

      // Cheap hash noise
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

        // Slow drifting field
        float t = uT * 0.04;
        float n = fbm(p*2.2 + vec2(t, -t*0.7));
        n = pow(n, 1.4);

        // Distance to cursor — soft warm halo (no shock; just presence)
        float d = distance(p, m);
        float halo = exp(-d*2.6) * 0.65;

        // Greyscale base
        vec3 base = mix(vec3(0.04,0.04,0.05), vec3(0.18,0.18,0.20), n);

        // Subtle warm tint where halo is strong (the "alive" feeling, monochrome elsewhere)
        vec3 warm = vec3(0.78,0.55,0.18);  // muted amber
        base = mix(base, base + warm*0.07, halo);

        // Vignette pull
        float v = smoothstep(1.4, 0.2, length(uv-0.5));
        base *= 0.55 + 0.55*v;

        // Tiny grain for tactile feel
        float g = (hash(gl_FragCoord.xy + uT) - 0.5) * 0.012;
        gl_FragColor = vec4(base + g, 1.0);
      }
    `;

    const compile = (type, src) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, src); gl.compileShader(s);
      return s;
    };
    const prog = gl.createProgram();
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, vs));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(prog);
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);
    const aLoc = gl.getAttribLocation(prog, 'a');
    gl.enableVertexAttribArray(aLoc);
    gl.vertexAttribPointer(aLoc, 2, gl.FLOAT, false, 0, 0);

    const uT = gl.getUniformLocation(prog, 'uT');
    const uRes = gl.getUniformLocation(prog, 'uRes');
    const uMouse = gl.getUniformLocation(prog, 'uMouse');

    const dpr = Math.min(1.5, window.devicePixelRatio || 1); // throttle for Tauri webview
    const resize = () => {
      const w = canvas.clientWidth, h = canvas.clientHeight;
      canvas.width = w * dpr; canvas.height = h * dpr;
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(uRes, canvas.width, canvas.height);
    };
    resize();
    const obs = new ResizeObserver(resize);
    obs.observe(canvas);

    const onMove = (e) => {
      const rect = canvas.getBoundingClientRect();
      mouseRef.current.tx = (e.clientX - rect.left) / rect.width;
      mouseRef.current.ty = 1 - (e.clientY - rect.top) / rect.height;
    };
    window.addEventListener('pointermove', onMove);

    let raf, start = performance.now();
    const tick = () => {
      const t = (performance.now() - start) / 1000;
      // Ease the mouse to smooth jitter
      const m = mouseRef.current;
      m.x += (m.tx - m.x) * 0.06;
      m.y += (m.ty - m.y) * 0.06;
      gl.uniform1f(uT, t);
      gl.uniform2f(uMouse, m.x, m.y);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      raf = requestAnimationFrame(tick);
    };
    tick();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', onMove);
      obs.disconnect();
    };
  }, [reduce]);

  return <canvas ref={ref} style={{
    position:'absolute', inset:0, width:'100%', height:'100%',
    display:'block', zIndex:0, pointerEvents:'none'
  }} />;
});

window.Shader = Shader;
