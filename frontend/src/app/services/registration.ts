import { Injectable } from '@angular/core';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase.config';

@Injectable({ providedIn: 'root' })
export class RegistrationService {
  async register(name: string, email: string, room: string): Promise<void> {
    await addDoc(collection(db, 'registrations'), {
      name,
      email,
      room,
      timestamp: serverTimestamp()
    });
  }
}
