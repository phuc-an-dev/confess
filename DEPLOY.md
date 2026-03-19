# 🚀 Deployment Guide

## Tổng quan

| Dịch vụ | Vai trò | Phí |
|---|---|---|
| [MongoDB Atlas](https://cloud.mongodb.com) | Database | Miễn phí (M0) |
| [Render](https://render.com) | Backend (Node.js + Socket.io) | Miễn phí |
| [Netlify](https://netlify.com) | Frontend (React) | Miễn phí |

---

## Bước 1 — Tạo MongoDB Atlas Database

1. Vào [cloud.mongodb.com](https://cloud.mongodb.com) → đăng ký / đăng nhập.
2. Tạo **Project** mới → chọn **Create Cluster** → chọn **M0 (Free)**.
3. Chọn cloud provider và region gần bạn (Singapore là ok).
4. Sau khi tạo xong, vào **Database Access** → **Add New Database User**:
   - Username/password tùy ý, lưu lại để dùng sau.
5. Vào **Network Access** → **Add IP Address** → chọn **Allow Access from Anywhere** (`0.0.0.0/0`).
6. Vào cluster → nhấn **Connect** → **Drivers** → copy chuỗi Connection String, dạng:
   ```
   mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```
   Thay `<username>` và `<password>` bằng thông tin ở bước 4.

---

## Bước 2 — Deploy Backend lên Render

1. Push toàn bộ code lên **GitHub** (nếu chưa có).
2. Vào [render.com](https://render.com) → **New** → **Web Service**.
3. Kết nối GitHub repo của bạn.
4. Cấu hình:

   | Trường | Giá trị |
   |---|---|
   | **Root Directory** | `server` |
   | **Runtime** | `Node` |
   | **Build Command** | `npm install` |
   | **Start Command** | `node src/server.js` |

5. Kéo xuống **Environment Variables** → thêm:

   | Key | Value |
   |---|---|
   | `MONGODB_URI` | *(chuỗi Atlas từ Bước 1)* |
   | `CLIENT_URL` | *(để trống tạm, điền sau ở Bước 4)* |
   | `PORT` | `3001` |

6. Nhấn **Create Web Service** → chờ deploy xong.
7. Copy URL của service, dạng: `https://your-app.onrender.com` — **lưu lại**.

---

## Bước 3 — Deploy Frontend lên Netlify

1. Vào [netlify.com](https://netlify.com) → **Add New Site** → **Import an existing project**.
2. Kết nối GitHub repo → chọn repo của bạn.
3. Cấu hình:

   | Trường | Giá trị |
   |---|---|
   | **Base directory** | `client` |
   | **Build command** | `npm run build` |
   | **Publish directory** | `client/dist` |

4. Kéo xuống **Environment Variables** → thêm:

   | Key | Value |
   |---|---|
   | `VITE_SERVER_URL` | *(URL Render từ Bước 2, ví dụ `https://your-app.onrender.com`)* |

5. Nhấn **Deploy Site** → chờ build xong.
6. Copy URL Netlify, dạng: `https://your-game.netlify.app` — **lưu lại**.

---

## Bước 4 — Cập nhật CORS trên Render

1. Quay lại [render.com](https://render.com) → vào service backend → **Environment**.
2. Cập nhật biến `CLIENT_URL` thành URL Netlify từ Bước 3:
   ```
   CLIENT_URL=https://your-game.netlify.app
   ```
3. Render sẽ tự **redeploy** — chờ khoảng 1-2 phút.

---

## Bước 5 — Thêm file ảnh meme (nếu chưa có)

Trước khi push lên GitHub, đảm bảo thư mục sau tồn tại và có ảnh:

```
client/public/memes/
  meme-01.png
  meme-02.png
  ...
  meme-10.png
```

Netlify sẽ serve các file này tự động như static assets.

---

## Kiểm tra hoạt động

1. Mở `https://your-game.netlify.app` → tạo phòng, lấy mã code.
2. Mở **Cửa sổ Ẩn danh** → vào `https://your-game.netlify.app` → nhập mã code để join.
3. Host nhấn **Start Writing** → cả 2 chuyển sang màn hình viết câu hỏi.
4. Submit câu hỏi → Host nhấn **Start Playing** → chơi bình thường.

> **Lưu ý:** Render free tier có thể **ngủ** sau 15 phút không có request. Lần đầu truy cập sau khi ngủ có thể mất 30-60 giây để wake up. Sau đó tốc độ bình thường.

---

## Troubleshooting

| Triệu chứng | Nguyên nhân thường gặp |
|---|---|
| Frontend mở được nhưng không join được phòng | `VITE_SERVER_URL` sai hoặc thiếu `https://` |
| Backend crash ngay khi start | `MONGODB_URI` sai hoặc IP chưa được whitelist trên Atlas |
| Meme không hiện | File ảnh chưa được đặt vào `client/public/memes/` trước khi build |
| CORS error trên console | `CLIENT_URL` trên Render chưa được cập nhật thành URL Netlify |
