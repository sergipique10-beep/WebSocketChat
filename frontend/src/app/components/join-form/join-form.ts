import { Component, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { RegistrationService } from '../../services/registration';

const AFICIONES = ['Música', 'Deportes', 'Gaming', 'Cine', 'Tecnología', 'Arte', 'Viajes', 'Cocina', 'Lectura', 'Ciencia'];

@Component({
  selector: 'app-join-form',
  standalone: true,
  imports: [FormsModule, CommonModule],
  templateUrl: './join-form.html',
  styleUrl: './join-form.css'
})
export class JoinForm {
  username = '';
  email = '';
  selectedRoom = '';
  customRoom = '';
  aficiones = AFICIONES;
  loading = signal(false);
  error = signal('');

  leaves = Array.from({ length: 22 }, () => ({
    x: Math.random() * 110 - 5,
    size: 10 + Math.random() * 14,
    duration: 8 + Math.random() * 10,
    delay: -(Math.random() * 15),
    opacity: 0.55 + Math.random() * 0.35,
    color: ['#6b8c3a','#8b6914','#5a7a2a','#a07828','#3d5c1e','#7a5010'][Math.floor(Math.random()*6)],
    shape: ['🍃','🍂','🍁'][Math.floor(Math.random()*3)]
  }));

  birdGroups = Array.from({ length: 6 }, () => ({
    top: 5 + Math.random() * 40,
    duration: 18 + Math.random() * 20,
    delay: -(Math.random() * 30),
    scale: 0.5 + Math.random() * 0.8,
    birds: Array.from({ length: 2 + Math.floor(Math.random() * 4) }, () => ({
      offsetX: Math.random() * 30 - 15,
      offsetY: Math.random() * 14 - 7
    }))
  }));

  constructor(private router: Router, private reg: RegistrationService) {}

  selectRoom(aficion: string): void {
    this.selectedRoom = this.selectedRoom === aficion ? '' : aficion;
    this.customRoom = '';
  }

  onCustomRoomChange(): void {
    if (this.customRoom.trim()) this.selectedRoom = '';
  }

  get effectiveRoom(): string {
    return this.customRoom.trim() || this.selectedRoom;
  }

  get canJoin(): boolean {
    return !!this.username.trim() && !!this.email.trim() && !!this.effectiveRoom && !this.loading();
  }

  async join(): Promise<void> {
    if (!this.canJoin) return;
    this.loading.set(true);
    this.error.set('');
    try {
      await this.reg.register(this.username.trim(), this.email.trim(), this.effectiveRoom);
      this.router.navigate(['/chat'], {
        queryParams: { username: this.username.trim(), room: this.effectiveRoom }
      });
    } catch {
      this.error.set('Error al registrar. Inténtalo de nuevo.');
      this.loading.set(false);
    }
  }
}
