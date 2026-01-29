export interface Post {
  id: string;
  text: string;
  author: string; // Id del user o persona que lo creó
  createdAt: Date;
  expiresAt: Date;
  likes: number; 
}
