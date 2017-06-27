import { Component } from '@angular/core';
import { NavController } from 'ionic-angular';

import { HomePage } from './../home/home';


@Component({
  selector: 'page-contact',
  templateUrl: 'contact.html'
})
export class ContactPage {

	homePage = HomePage;

	constructor(public navCtrl: NavController) {

	}

}
