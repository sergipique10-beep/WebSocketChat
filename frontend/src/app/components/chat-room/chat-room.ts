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
  isConnected = false;

  private subs = new Subscription();

  constructor(
    private route: ActivatedRoute,
    private chatService: Chat
  ) {}

  ngOnInit(): void {
    this.username = this.route.snapshot.queryParams['username'] || 'Anónimo';
    this.chatService.connect(this.username);

    this.subs.add(
      this.chatService.messages$.subscribe((msg) => this.messages.push(msg))
    );
    this.subs.add(
      this.chatService.connected$.subscribe((status) => (this.isConnected = status))
    );
  }

  sendMessage(): void {
    const trimmed = this.newMessage.trim();
    if (trimmed) {
      this.chatService.send(trimmed);
      this.newMessage = '';
    }
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
    this.chatService.disconnect();
  }
}
