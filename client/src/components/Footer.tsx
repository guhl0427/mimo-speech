type Props = {
  statusText: string;
  warning?: boolean;
  sttEnabled?: boolean;
  onInfo: () => void;
};

export function Footer({
  statusText,
  warning = false,
  sttEnabled = true,
  onInfo,
}: Props) {
  return (
    <footer className="site-foot">
      <div>
        声息 / 个人版 v1.0
        <br />
        <span className={warning ? "foot-demo" : ""}>{statusText}</span>
      </div>
      <div className="foot-right">
        {sttEnabled ? "语音转文字 + 文字转语音 · 个人自用" : "文字转语音 · 个人站点"}
        <br />
        <button className="text-link" type="button" onClick={onInfo}>
          隐私与计费说明
        </button>
      </div>
    </footer>
  );
}
