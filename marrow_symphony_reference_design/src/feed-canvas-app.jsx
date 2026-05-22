// Mount: DesignCanvas with the Feed view in two states.

function FeedCanvasApp() {
  return (
    <DesignCanvas>
      <DCSection
        id="feed"
        title="Feed"
        subtitle="One Needs-Input Session at a time, full-screen. Shader + glass prominent; terminal solid."
      >
        <DCArtboard id="active" label="A · Active — agent waiting on a patch decision" width={1440} height={900}>
          <FeedScreen />
        </DCArtboard>

        <DCArtboard id="empty" label="B · Inbox zero — no agents need you" width={1440} height={900}>
          <FeedInboxZero />
        </DCArtboard>
      </DCSection>
    </DesignCanvas>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<FeedCanvasApp />);
