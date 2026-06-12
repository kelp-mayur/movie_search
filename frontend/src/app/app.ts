import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Searchbar } from './searchbar/searchbar';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Searchbar],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {}
