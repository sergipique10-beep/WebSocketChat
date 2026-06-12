import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { provideRouter } from '@angular/router';
import { JoinForm } from './join-form';

describe('JoinForm', () => {
  let component: JoinForm;
  let fixture: ComponentFixture<JoinForm>;
  let router: Router;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [JoinForm],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(JoinForm);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockImplementation(() => Promise.resolve(true));
    fixture.detectChanges();
  });

  it('should create', () => expect(component).toBeTruthy());

  it('should not navigate when username is empty', () => {
    component.username = '';
    component.join();
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('should not navigate when username is only whitespace', () => {
    component.username = '   ';
    component.join();
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('should navigate to /chat with trimmed username', () => {
    component.username = ' Mati ';
    component.join();
    expect(router.navigate).toHaveBeenCalledWith(['/chat'], {
      queryParams: { username: 'Mati' },
    });
  });
});
