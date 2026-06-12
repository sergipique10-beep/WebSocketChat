import { Injectable } from '@angular/core';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase.config';

@Injectable({ providedIn: 'root' })
export class RegistrationService {
  async register(name: string, email: string, room: string): Promise<void> {
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Tiempo de conexión agotado')), 8000)
    );
    await Promise.race([
      addDoc(collection(db, 'registrations'), { name, email, room, timestamp: serverTimestamp() }),
      timeout
    ]);
  }
}
