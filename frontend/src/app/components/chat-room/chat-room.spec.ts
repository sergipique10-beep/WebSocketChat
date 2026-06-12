import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { Subject } from 'rxjs';
import { provideRouter } from '@angular/router';
import { Chat } from '../../services/chat';
import { ChatRoom } from './chat-room';
import { Message } from '../../models/message.model';

describe('ChatRoom', () => {
  let component: ChatRoom;
  let fixture: ComponentFixture<ChatRoom>;
  let mockMessages$: Subject<Message>;
  let mockConnected$: Subject<boolean>;
  let mockChat: { connect: ReturnType<typeof vi.fn>, send: ReturnType<typeof vi.fn>, disconnect: ReturnType<typeof vi.fn>, messages$: Subject<Message>, connected$: Subject<boolean> };

  beforeEach(async () => {
    mockMessages$ = new Subject<Message>();
    mockConnected$ = new Subject<boolean>();

    mockChat = {
      connect: vi.fn(),
      send: vi.fn(),
      disconnect: vi.fn(),
      messages$: mockMessages$,
      connected$: mockConnected$,
    };

    await TestBed.configureTestingModule({
      imports: [ChatRoom],
      providers: [
        { provide: Chat, useValue: mockChat },
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { snapshot: { queryParams: { username: 'Mati' } } } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ChatRoom);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => expect(component).toBeTruthy());

  it('should connect on init with username from route', () => {
    expect(mockChat.connect).toHaveBeenCalledWith('Mati');
  });

  it('should add incoming messages to list', () => {
    const msg: Message = { username: 'Juan', message: 'Hola', timestamp: '2026-06-12T10:00:00' };
    mockMessages$.next(msg);
    expect(component.messages.length).toBe(1);
    expect(component.messages[0]).toEqual(msg);
  });

  it('should update isConnected on connected$ events', () => {
    mockConnected$.next(true);
    expect(component.isConnected).toBe(true);
    mockConnected$.next(false);
    expect(component.isConnected).toBe(false);
  });

  it('should not send empty or whitespace message', () => {
    component.newMessage = '   ';
    component.sendMessage();
    expect(mockChat.send).not.toHaveBeenCalled();
  });

  it('should send trimmed message and clear input', () => {
    component.newMessage = ' Hola! ';
    component.sendMessage();
    expect(mockChat.send).toHaveBeenCalledWith('Hola!');
    expect(component.newMessage).toBe('');
  });

  it('should disconnect on destroy', () => {
    component.ngOnDestroy();
    expect(mockChat.disconnect).toHaveBeenCalled();
  });
});
