import express, { Application } from "express";
import socketIO, { Server as SocketIOServer } from "socket.io";
// import * as HTTP from "http";
import * as https from "https";
import path from "path";
import * as fs from "fs";


const certificatePath = {
  key: fs.readFileSync('/etc/letsencrypt/live/my_api_url/privkey.pem'),
  cert: fs.readFileSync('/etc/letsencrypt/live/my_api_url/fullchain.pem'),
};

export class Server {
  // private httpServer: HTTP.Server;
  private httpsServer: https.Server;
  private app: Application;
  private io: SocketIOServer;

  private activeSockets: string[] = [];

  private readonly DEFAULT_PORT = 5555;

  constructor() {
    this.initialize();
  }

  private initialize(): void {
    this.app = express();
    // this.httpServer = HTTP.createServer(this.app);
    this.httpsServer = https.createServer(certificatePath, this.app);
    this.io = socketIO(this.httpsServer);

    this.configureApp();
    this.configureRoutes();
    this.handleSocketConnection();
  }

  private configureApp(): void {
    this.app.use(express.static(path.join(__dirname, "../public")));
  }

  private configureRoutes(): void {
    this.app.get("/", (req, res) => {
      res.sendFile("index.html");
    });
  }

  private handleSocketConnection(): void {
    this.io.on("connection", socket => {
      const existingSocket = this.activeSockets.find(
        existingSocket => existingSocket === socket.id
      );

      if (!existingSocket) {
        this.activeSockets.push(socket.id);

        socket.emit("update-user-list", {
          users: this.activeSockets.filter(
            existingSocket => existingSocket !== socket.id
          )
        });

        socket.broadcast.emit("update-user-list", {
          users: [socket.id]
        });
      }

      socket.on("call-user", (data: any) => {
        socket.to(data.to).emit("call-made", {
          offer: data.offer,
          socket: socket.id
        });
      });

      socket.on("make-answer", data => {
        socket.to(data.to).emit("answer-made", {
          socket: socket.id,
          answer: data.answer
        });
      });

      socket.on("reject-call", data => {
        socket.to(data.from).emit("call-rejected", {
          socket: socket.id
        });
      });

      socket.on("disconnect", () => {
        this.activeSockets = this.activeSockets.filter(
          existingSocket => existingSocket !== socket.id
        );
        socket.broadcast.emit("remove-user", {
          socketId: socket.id
        });
      });
    });
  }

  public listen(callback: (port: number) => void): void {
    this.httpsServer.listen(this.DEFAULT_PORT, () => {
      callback(this.DEFAULT_PORT);
    });
  }
}
