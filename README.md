# Helen Is Reading

靜態個人書籍 / 電影 / 影集時間流網站。

線上網址：
[https://helenisreading.netlify.app](https://helenisreading.netlify.app)

## 專案結構

- `index.html`：頁面結構
- `styles.css`：樣式
- `script.js`：互動、資料搜尋與本機儲存
- `netlify.toml`：Netlify 靜態站設定

## 本機使用

直接打開 `index.html` 即可預覽。

注意：
目前資料儲存在瀏覽器 `localStorage`。
這代表你在自己瀏覽器中新增的內容，不會自動跟著 GitHub 或 Netlify 一起同步。

## 發布到 GitHub

1. 在 GitHub 建立一個新的 repository
2. 把目前資料夾中的所有檔案上傳到 repository 根目錄
3. 確認至少包含以下檔案：

- `index.html`
- `styles.css`
- `script.js`
- `README.md`
- `.gitignore`
- `netlify.toml`

## 連接 Netlify 自動部署

1. 登入 Netlify
2. 選擇 `Add new site` -> `Import an existing project`
3. 連接你的 GitHub repository
4. Build 設定使用以下內容：

```txt
Build command: （留空）
Publish directory: .
```

5. 完成後，之後每次你更新 GitHub，Netlify 都會自動重新部署

## 後續維護

如果你要修改網站：

1. 先修改本地檔案
2. 測試確認沒問題
3. 上傳或提交到 GitHub
4. 等 Netlify 自動部署完成

## 備註

- 書籍資料來源目前使用：豆瓣 -> Open Library -> Google Books
- 電影資料來源目前使用：Apple iTunes Search
- 影集資料來源目前使用：TVmaze

如果之後要讓不同裝置共用同一份時間流資料，下一步需要改成 JSON / 後端資料庫方案，而不是只存 `localStorage`。
