// Mount: DesignCanvas with two artboards (expanded + collapsed shell).

const { useState, useEffect } = React;

function CanvasApp() {
  return (
    <DesignCanvas>
      <DCSection
        id="shell"
        title="App shell"
        subtitle="Persistent topbar + sidebar over the shader backdrop. ⌘B toggles inside each artboard."
      >
        <DCArtboard id="expanded" label="A · Expanded sidebar — 240px glass card" width={1440} height={900}>
          <AppShell initialOpen={true} initialView="board" />
        </DCArtboard>

        <DCArtboard id="collapsed" label="B · Sidebar hidden — full-bleed main" width={1440} height={900}>
          <AppShell initialOpen={false} initialView="cockpit" />
        </DCArtboard>
      </DCSection>
    </DesignCanvas>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<CanvasApp />);
