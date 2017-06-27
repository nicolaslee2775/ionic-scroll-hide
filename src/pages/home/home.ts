import { Component } from '@angular/core';
import { NavController, ViewController } from 'ionic-angular';


import { ContactPage } from './../contact/contact';



@Component({
	selector: 'page-home',
	templateUrl: 'home.html'
})
export class HomePage {

	page = ContactPage;
	

	constructor(public navCtrl: NavController, 
				public viewCtrl: ViewController) {
	}

}
