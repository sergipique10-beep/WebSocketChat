import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-join-form',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './join-form.html',
})
export class JoinForm {
  username = '';

  constructor(private router: Router) {}

  join(): void {
    const trimmed = this.username.trim();
    if (trimmed) {
      this.router.navigate(['/chat'], { queryParams: { username: trimmed } });
    }
  }
}
