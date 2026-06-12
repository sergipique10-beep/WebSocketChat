import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

const AFICIONES = ['Música', 'Deportes', 'Gaming', 'Cine', 'Tecnología', 'Arte', 'Viajes', 'Cocina', 'Lectura', 'Ciencia'];

@Component({
  selector: 'app-join-form',
  standalone: true,
  imports: [FormsModule, CommonModule],
  templateUrl: './join-form.html',
})
export class JoinForm {
  username = '';
  selectedRoom = '';
  customRoom = '';
  aficiones = AFICIONES;

  constructor(private router: Router) {}

  selectRoom(aficion: string): void {
    this.selectedRoom = this.selectedRoom === aficion ? '' : aficion;
    this.customRoom = '';
  }

  onCustomRoomChange(): void {
    if (this.customRoom.trim()) {
      this.selectedRoom = '';
    }
  }

  get effectiveRoom(): string {
    return this.customRoom.trim() || this.selectedRoom;
  }

  get canJoin(): boolean {
    return !!this.username.trim() && !!this.effectiveRoom;
  }

  join(): void {
    if (this.canJoin) {
      this.router.navigate(['/chat'], {
        queryParams: { username: this.username.trim(), room: this.effectiveRoom }
      });
    }
  }
}
