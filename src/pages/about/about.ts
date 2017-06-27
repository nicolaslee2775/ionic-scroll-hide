import { Component } from '@angular/core';
import { NavController, ViewController } from 'ionic-angular';

@Component({
  selector: 'page-about',
  templateUrl: 'about.html'
})
export class AboutPage {

	constructor(public navCtrl: NavController, 
				public viewCtrl: ViewController) {

	}

}
