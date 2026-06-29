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

  embers = Array.from({ length: 25 }, () => ({
    x: Math.random() * 100,
    size: 2 + Math.random() * 3,
    duration: 4 + Math.random() * 4,
    delay: -(Math.random() * 6),
    color: `hsl(${10 + Math.random() * 20}, 90%, ${25 + Math.random() * 20}%)`
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
