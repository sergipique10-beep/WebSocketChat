import { Component, OnInit, OnDestroy, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Chat } from '../../services/chat';
import { Message } from '../../models/message.model';

@Component({
  selector: 'app-chat-room',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe],
  templateUrl: './chat-room.html',
  styleUrl: './chat-room.css'
})
export class ChatRoom implements OnInit, OnDestroy {
  messages = signal<Message[]>([]);
  newMessage = '';
  username = '';
  currentRoom = signal('');
  isConnected = signal(false);
  availableRooms = signal<string[]>([]);

  particles = Array.from({ length: 40 }, () => ({
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: 3 + Math.random() * 5,
    duration: 4 + Math.random() * 7,
    delay: -(Math.random() * 10)
  }));

  private subs = new Subscription();
  private pollInterval: ReturnType<typeof setInterval> | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private chatService: Chat
  ) {}

  ngOnInit(): void {
    this.username = this.route.snapshot.queryParams['username'] || 'Anónimo';
    this.currentRoom.set(this.route.snapshot.queryParams['room'] || 'General');
    this.joinRoom(this.currentRoom());
    this.pollRooms();
    this.pollInterval = setInterval(() => this.pollRooms(), 5000);
  }

  private joinRoom(room: string): void {
    this.messages.set([]);
    this.currentRoom.set(room);
    this.chatService.connect(this.username, room);

    this.subs.add(
      this.chatService.messages$.subscribe((msg) => this.messages.update(msgs => [...msgs, msg]))
    );
    this.subs.add(
      this.chatService.connected$.subscribe((status) => this.isConnected.set(status))
    );
  }

  switchRoom(room: string): void {
    if (room === this.currentRoom()) return;
    this.subs.unsubscribe();
    this.subs = new Subscription();
    this.joinRoom(room);
  }

  private async pollRooms(): Promise<void> {
    const rooms = await this.chatService.getRooms();
    const combined = new Set([...rooms, this.currentRoom()]);
    this.availableRooms.set(Array.from(combined));
  }

  sendMessage(): void {
    const trimmed = this.newMessage.trim();
    if (trimmed) {
      this.chatService.send(trimmed);
      this.newMessage = '';
    }
  }

  leave(): void {
    this.chatService.disconnect();
    this.router.navigate(['/']);
  }

  ngOnDestroy(): void {
    if (this.pollInterval) clearInterval(this.pollInterval);
    this.subs.unsubscribe();
    this.chatService.disconnect();
  }
}
