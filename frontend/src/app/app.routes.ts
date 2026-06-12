import { Routes } from '@angular/router';
import { JoinForm } from './components/join-form/join-form';
import { ChatRoom } from './components/chat-room/chat-room';

export const routes: Routes = [
  { path: '', component: JoinForm },
  { path: 'chat', component: ChatRoom },
  { path: '**', redirectTo: '' },
];
