import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Header } from './shared/components/header/header';
import { InactivityWarning } from './features/auth/inactivity-warning/inactivity-warning';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Header, InactivityWarning],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {}
