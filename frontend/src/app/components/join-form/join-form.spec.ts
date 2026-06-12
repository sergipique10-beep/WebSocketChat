import { ComponentFixture, TestBed } from '@angular/core/testing';

import { JoinForm } from './join-form';

describe('JoinForm', () => {
  let component: JoinForm;
  let fixture: ComponentFixture<JoinForm>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [JoinForm],
    }).compileComponents();

    fixture = TestBed.createComponent(JoinForm);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
