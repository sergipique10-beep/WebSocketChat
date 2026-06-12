import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { Chat } from './chat';
import { Message } from '../models/message.model';

describe('Chat', () => {
  let service: Chat;
  let mockWs: {
    readyState: number;
    send: ReturnType<typeof vi.fn>;
    close: ReturnType<typeof vi.fn>;
    onopen: (() => void) | null;
    onmessage: ((e: { data: string }) => void) | null;
    onclose: (() => void) | null;
    onerror: (() => void) | null;
  };

  beforeEach(() => {
    mockWs = {
      readyState: WebSocket.OPEN,
      send: vi.fn(),
      close: vi.fn(),
      onopen: null,
      onmessage: null,
      onclose: null,
      onerror: null,
    };
    vi.spyOn(window, 'WebSocket').mockImplementation(function () { return mockWs; } as unknown as typeof WebSocket);
    TestBed.configureTestingModule({});
    service = TestBed.inject(Chat);
  });

  afterEach(() => service.disconnect());

  it('should be created', () => expect(service).toBeTruthy());

  it('should open WebSocket with correct URL on connect', () => {
    service.connect('Mati');
    expect(window.WebSocket).toHaveBeenCalledWith('ws://localhost:8000/ws/Mati');
  });

  it('should emit true on connected$ when ws opens', () =>
    new Promise<void>((resolve) => {
      service.connect('Mati');
      service.connected$.subscribe((status) => {
        expect(status).toBe(true);
        resolve();
      });
      mockWs.onopen!();
    }));

  it('should emit parsed message on messages$ when ws receives data', () =>
    new Promise<void>((resolve) => {
      const testMsg: Message = { username: 'Juan', message: 'Hola', timestamp: '2026-06-12T10:00:00' };
      service.connect('Mati');
      service.messages$.subscribe((msg) => {
        expect(msg).toEqual(testMsg);
        resolve();
      });
      mockWs.onmessage!({ data: JSON.stringify(testMsg) });
    }));

  it('should call ws.send when connected and send() is called', () => {
    service.connect('Mati');
    service.send('test message');
    expect(mockWs.send).toHaveBeenCalledWith('test message');
  });

  it('should not call ws.send when disconnected', () => {
    service.connect('Mati');
    mockWs.readyState = WebSocket.CLOSED;
    service.send('test message');
    expect(mockWs.send).not.toHaveBeenCalled();
  });
});
