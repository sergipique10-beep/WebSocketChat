import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
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
})
export class ChatRoom implements OnInit, OnDestroy {
  messages: Message[] = [];
  newMessage = '';
  username = '';
  currentRoom = '';
  isConnected = false;
  availableRooms: string[] = [];

  private subs = new Subscription();
  private pollInterval: ReturnType<typeof setInterval> | null = null;

  constructor(
    private route: ActivatedRoute,
    private chatService: Chat
  ) {}

  ngOnInit(): void {
    this.username = this.route.snapshot.queryParams['username'] || 'Anónimo';
    this.currentRoom = this.route.snapshot.queryParams['room'] || 'General';
    this.joinRoom(this.currentRoom);
    this.pollRooms();
    this.pollInterval = setInterval(() => this.pollRooms(), 5000);
  }

  private joinRoom(room: string): void {
    this.messages = [];
    this.currentRoom = room;
    this.chatService.connect(this.username, room);

    this.subs.add(
      this.chatService.messages$.subscribe((msg) => this.messages.push(msg))
    );
    this.subs.add(
      this.chatService.connected$.subscribe((status) => (this.isConnected = status))
    );
  }

  switchRoom(room: string): void {
    if (room === this.currentRoom) return;
    this.subs.unsubscribe();
    this.subs = new Subscription();
    this.joinRoom(room);
  }

  private async pollRooms(): Promise<void> {
    const rooms = await this.chatService.getRooms();
    const combined = new Set([...rooms, this.currentRoom]);
    this.availableRooms = Array.from(combined);
  }

  sendMessage(): void {
    const trimmed = this.newMessage.trim();
    if (trimmed) {
      this.chatService.send(trimmed);
      this.newMessage = '';
    }
  }

  ngOnDestroy(): void {
    if (this.pollInterval) clearInterval(this.pollInterval);
    this.subs.unsubscribe();
    this.chatService.disconnect();
  }
}
