import { Component, OnInit, OnDestroy, signal, computed } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Chat } from '../../services/chat';

@Component({
  selector: 'app-chat-room',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe],
  templateUrl: './chat-room.html',
  styleUrl: './chat-room.css'
})
export class ChatRoom implements OnInit, OnDestroy {
  newMessage = '';
  username = '';

  private pollInterval: ReturnType<typeof setInterval> | null = null;
  private allRooms = signal<string[]>([]);

  readonly currentRoom = this.chatService.activeRoom;
  readonly isConnected = this.chatService.activeConnected;
  readonly messages = this.chatService.activeMessages;
  readonly joinedRooms = this.chatService.joinedRooms;

  readonly availableRooms = computed(() =>
    this.allRooms().filter(r => !this.chatService.joinedRooms().includes(r))
  );

  particles = Array.from({ length: 40 }, () => ({
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: 3 + Math.random() * 5,
    duration: 4 + Math.random() * 7,
    delay: -(Math.random() * 10)
  }));

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    readonly chatService: Chat
  ) {}

  ngOnInit(): void {
    this.username = this.route.snapshot.queryParams['username'] || 'Anónimo';
    const room = this.route.snapshot.queryParams['room'] || 'General';
    this.chatService.joinRoom(this.username, room);
    this.pollRooms();
    this.pollInterval = setInterval(() => this.pollRooms(), 5000);
  }

  joinRoom(room: string): void {
    this.chatService.joinRoom(this.username, room);
  }

  leaveRoom(room: string): void {
    this.chatService.leaveRoom(room);
    if (this.chatService.joinedRooms().length === 0) {
      this.router.navigate(['/']);
    }
  }

  switchRoom(room: string): void {
    this.chatService.setActiveRoom(room);
  }

  unreadFor(room: string): number {
    return this.chatService.unreadFor(room);
  }

  sendMessage(): void {
    const trimmed = this.newMessage.trim();
    if (trimmed) {
      this.chatService.send(trimmed);
      this.newMessage = '';
    }
  }

  leave(): void {
    this.chatService.leaveAll();
    this.router.navigate(['/']);
  }

  private async pollRooms(): Promise<void> {
    const rooms = await this.chatService.getRooms();
    const joined = this.chatService.joinedRooms();
    const combined = new Set([...rooms, ...joined]);
    this.allRooms.set(Array.from(combined));
  }

  ngOnDestroy(): void {
    if (this.pollInterval) clearInterval(this.pollInterval);
  }
}
