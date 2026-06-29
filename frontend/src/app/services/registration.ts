import { Injectable } from '@angular/core';
import { supabase } from '../../supabase.config';

@Injectable({ providedIn: 'root' })
export class RegistrationService {
  async register(name: string, email: string, room: string): Promise<void> {
    const { error } = await supabase
      .from('registrations')
      .insert({ name, email, room });
    if (error) console.warn('Registration skipped:', error.message);
  }
}
