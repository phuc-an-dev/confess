# Game Room Web App

A party game where players join a room, write questions, and take turns answering randomly drawn questions while reacting with memes. 

## Local Development (Localhost)

To run this project locally, you need two terminal windows: one for the backend server and one for the frontend client. You also need a local MongoDB instance running, or you can provide a MongoDB Atlas URI.

### 1. Setup Backend Server

1. Open a terminal and navigate to the backend folder:
   ```bash
   cd server
   ```
2. Create a `.env` file in the `server` directory (optional for localhost, but good for custom settings):
   ```env
   MONGODB_URI=mongodb://localhost:27017/gameroom
   PORT=3001
   CLIENT_URL=http://localhost:5173
   ```
3. Run the development server:
   ```bash
   npm run dev
   ```
   *Note: Ensure you have MongoDB running locally on port 27017, otherwise the server will fail to connect to the database.*

### 2. Setup Frontend Client

1. Open a second terminal and navigate to the frontend folder:
   ```bash
   cd client
   ```
2. Create a `.env` file in the `client` directory:
   ```env
   VITE_SERVER_URL=http://localhost:3001
   ```
3. Start the Vite dev server:
   ```bash
   npm run dev
   ```
4. Open your browser and go to `http://localhost:5173`. You can open an incognito window to simulate a second player joining the room.

## Deployment

The project is designed to be deployed with **Render** (free backend hosting) and **Netlify** (free static frontend hosting).

### Backend Deployment (Render)
1. Push your code to a GitHub repository.
2. Create a new **Web Service** on [Render](https://render.com/).
3. Connect your GitHub repository.
4. Set the Root Directory to `server`.
5. Set the Build Command to `npm install`.
6. Set the Start Command to `node src/server.js`.
7. Add Environment Variables:
   - `MONGODB_URI`: Your MongoDB Atlas connection string (create a free cluster on MongoDB Atlas if you don't have one).
   - `CLIENT_URL`: The URL of your future Netlify app (e.g., `https://your-game-room.netlify.app`).
8. Deploy the service. Take note of your Render URL (e.g., `https://your-backend.onrender.com`).

### Frontend Deployment (Netlify)
1. Create a new Site on [Netlify](https://www.netlify.com/).
2. Connect your GitHub repository.
3. Set the Base directory to `client`.
4. Set the Build command to `npm run build`.
5. Set the Publish directory to `client/dist`.
6. Add an Environment Variable:
   - `VITE_SERVER_URL`: Your Render backend URL (e.g., `https://your-backend.onrender.com`).
7. Deploy the site.

Your game will now be live on your Netlify URL, talking to your Render backend and MongoDB Atlas database!
