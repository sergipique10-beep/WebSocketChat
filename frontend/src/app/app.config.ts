import { ApplicationConfig, provideBrowserGlobalErrorListeners, provideExperimentalZonelessChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideExperimentalZonelessChangeDetection(),
    provideRouter(routes)
  ]
};
