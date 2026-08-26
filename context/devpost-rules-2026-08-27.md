# Devpost 規則摘要（2026-08-27 讀 https://webmcp.devpost.com/ ）

- 截止：Sep 3, 2026 1:00pm PDT（台北 9/4 04:00）
- 交件四項：① 線上 URL，評審用 ChatGPT 內建瀏覽器或開 WebMCP 的 Chrome 開 ② 文字說明：為何 WebMCP 適合此用例、怎麼改善體驗、人與 agent 一起能做什麼、實作細節 ③ **<3 分鐘公開 YouTube 影片，要有聲音** ④ 公開 repo 含全部原始碼與說明，**必須附開源授權檔**（已加 MIT）
- 評分四項（無權重）：WebMCP Leverage／Execution／Potential Impact／Creativity & Ambition
- 既有專案：無禁止
- 資格：成年；排除名單含中國、香港等，台灣不在排除名單
- 獎：10 名各 $3,500 現金＋贊助商獎品（頁面與 OpenAI 官網的 $3,000 不一致，以 Devpost 為準）

對計畫的影響：評分項「Potential Impact」對應 Addy 說最弱的「有用」；影片 <3 分鐘且要旁白，9/2 那格要留錄音。

## 環境事實（2026-08-27 查證，取代簡報裡的假設）
- ChatGPT 桌面版：API 在 **`document.modelContext`**（非 navigator）；需 Settings › Browser › Permissions「Enable site tools」；模型 GPT-5.6 Sol／Terra（Luna 關閉）；地址列「Site tools」可看已註冊工具；Recently used › Sources 可看呼叫紀錄。**未見 `requestUserInteraction` 文件**，確認靠 ChatGPT 自身的 confirmation policy。來源 https://learn.chatgpt.com/docs/webmcp
- Chrome：**Canary／Beta 146+**，`chrome://flags/#enable-webmcp-testing`；Stable 無。API 在 `navigator.modelContext`。來源 https://www.salamexperts.com/blog/ai/enable-webmcp-chrome/
- ⇒ 探針與 `/read` 都要雙註冊；寫入確認在 ChatGPT 端不是頁面能控制的，計畫 v2 的「submitFindings 走 requestUserInteraction」要改成「標 readOnlyHint:false，交給 ChatGPT 的確認政策」
