import { 
	Directive,
	ElementRef, NgZone, HostListener, Input, Renderer,
	OnInit, OnDestroy,
} from '@angular/core';

import { Content, ScrollEvent, NavController, ViewController } from 'ionic-angular'


import * as $ from 'jquery'





type DomWrite = (fn: (timeStamp?: number) => void, ctx?: any) => void;


function constrain(val: number, min: number, max: number) {
	return Math.min(max, Math.max(val, min));
}

function forEach(children: HTMLCollection, callback: (ele: HTMLElement) => void) {
	for(var i = 0; i < children.length; i++) {
		callback(<HTMLElement> children[i]);
	}
}


/*
interface Item {
	ele: HTMLElement;
	startY: number;
	endY: number;
	unshrinkable: boolean;
}
*/

enum ItemType {
	Navbar, Toolbar, Tabbar
}
class Item {
	public type: ItemType;
	public shrinkable: boolean;
	public startY = 0;
	public endY = 0;

	constructor(public ele: HTMLElement) {

		if(ele.classList.contains("tabbar")) {
			this.type = ItemType.Tabbar;
		} else if(ele.tagName === "ION-NAVBAR") {
			this.type = ItemType.Navbar;
		} else {
			this.type = ItemType.Toolbar;
		}

		this.shrinkable = !ele.classList.contains("unshrinkable");
	}

	setY(startY: number, endY: number) {
		this.startY = startY;
		this.endY = endY;
	}
}


@Directive({
	selector: '[scroll-hide]' // Attribute selector
})
export class ScrollHide implements OnInit, OnDestroy {
	
	@Input() navCtrl: NavController;
	@Input() viewCtrl: ViewController;

	initiated: boolean = false;

	contentTop: number;
	endY: number;

	//tabbarOnBottom: boolean = true;
	//tabbarEle: HTMLElement;
	headerItems: Item[] = [];
	footerItems: Item[] = [];

	headerEle: HTMLElement;
	footerEle: HTMLElement;

	constructor(private content: Content, 
				private renderer: Renderer,
				private zone: NgZone) {}
	

	ngOnInit() {
		this.content.fullscreen = true;

		//console.log("mode:", this.content._mode, "tabs:", this.content._tabs);
		console.log("ngOnInit() > navCtrl:", this.navCtrl);
		console.log("ngOnInit() > viewCtrl:", this.viewCtrl);


		this.viewCtrl.didEnter.subscribe(() => {
			//console.log("ScrollHide > viewCtrl.didEnter(), _tabsPlacement:", this.content._tabsPlacement);
			console.log("init()");
			this.init();
			this.content.resize();
		});

		this.viewCtrl.willLeave.subscribe(() => {
			console.log("resetStyle()");			
			this.resetStyle();
		});
		


		let win: any = window;
		win.temp = win.temp || {};
		win.temp.content = this.content;
		win.temp.zone = this.zone;
	}

	ngOnDestroy() {
		console.log("ngOnDestroy()");
	}

	private init() {
		this.y = 0;
		this.yPrev = 0;
		this.scrollTopPrev = this.content.scrollTop;



		let contentEle = <HTMLElement> this.content.getNativeElement();
		let headerEle  = <HTMLElement> contentEle.parentElement.querySelector("ion-header");
		let footerEle  = <HTMLElement> contentEle.parentElement.querySelector("ion-footer");
		
		if(headerEle) {
			this.headerItems = $(headerEle)
				.children()
				.toArray().map(ele => new Item(ele));
		}
		if(footerEle) {
			this.footerItems = $(footerEle)
				.children()
				.toArray().map(ele => new Item(ele));
		}




		let hasTabbar = (this.content._tabs !== null);
		if(hasTabbar) {
			//this.tabbarEle = this.content._tabs._tabbar.nativeElement;
			let tabbarEle = <HTMLElement> (<any> this.content._tabs)._tabbar.nativeElement;

			if(this.content._tabsPlacement === "bottom") {
				this.footerItems.push(new Item(tabbarEle));
			} else {
				this.headerItems.push(new Item(tabbarEle));
			}
		}


		this.headerItems = this.headerItems.reverse();
		this.footerItems = this.footerItems.reverse();

		


		var contentTop = 0;

		console.group("headerItems")

		var shrinkableHeightSum = 0;
		this.headerItems.forEach((item, index) => {
			contentTop += item.ele.offsetHeight;

			// Navbar would not be raised without setting position to relative			
			if(item.type === ItemType.Navbar) {
				$(item.ele).css("position", "relative")				
			}


			// Prevent overlapping of bottom element
			if(item.type === ItemType.Tabbar) {
				$(item.ele).css("overflow", "hidden");
				$(item.ele).children().css("align-self", "flex-end");
			} else {
				$(item.ele).css("z-index", index + 1);		
			}

			
			if(item.shrinkable) {
				item.setY(
					shrinkableHeightSum, 
					shrinkableHeightSum + item.ele.offsetHeight
				);
				shrinkableHeightSum += item.ele.offsetHeight;
				
			} else {
				item.setY(
					shrinkableHeightSum, 
					shrinkableHeightSum
				);
			}
			
			console.log(item, item.ele.offsetHeight);
		});
		this.contentTop = contentTop;
		this.defaultEnd = this.contentTop * 2;
		this.endY = shrinkableHeightSum;

		console.groupEnd();


		console.group("footerItems")
		this.footerItems.forEach(item => {
			console.log(item.ele, item.ele.offsetHeight);
		});
		console.groupEnd();
		
		console.log("contentTop:", contentTop, ", endY:", this.endY);


		/*
		ion-header {
			pointer-events: none;
		}

		ion-header > * {
			pointer-events: all;
		}*/

		if(headerEle) {
			$(headerEle).css("pointer-events", "none");
			$(headerEle).children().css("pointer-events", "all");
		}
		if(footerEle) {
			$(footerEle).css("pointer-events", "none");
			$(footerEle).children().css("pointer-events", "all");
		}

		this.headerEle = headerEle;
		this.footerEle = footerEle;
	}


	private resetStyle() {
		this.headerItems.forEach((item, index) => {

			if(item.type === ItemType.Navbar) {
				$(item.ele).css("position", "");		
			}

			if(item.type === ItemType.Tabbar) {
				$(item.ele).css("overflow", "");
				$(item.ele).children().css("align-self", "center");
			} else {
				$(item.ele).css("z-index", "");		
			}

		});

		if(this.headerEle) {
			$(this.headerEle).css("pointer-events", "none");
			$(this.headerEle).children().css("pointer-events", "all");
		}
		if(this.footerEle) {
			$(this.footerEle).css("pointer-events", "none");
			$(this.footerEle).children().css("pointer-events", "all");
		}


		// Header Items
		this.headerItems.forEach((item) => {

			
			$(item.ele).css("height", "");
			$(item.ele).css("display", "");	
			$(item.ele).css("webkitTransform", "");

			if(item.shrinkable) {	
				$(item.ele).children().not(".toolbar-background")
					.each((index, navbarChild) => {
						$(navbarChild).css("opacity", "");
					});
			}
		});


		// Footer Items
		this.footerItems.forEach((item) => {
			$(item.ele).css("webkitTransform", "");				
		});
	}



	defaultDelay: number = 400 * 2;
	defaultDuration: number = 400;

	defaultEnd: number = 0;
	y: number = 0;
	yPrev: number = 0;
	scrollTopPrev: number = 0;

	@HostListener("ionScroll", ["$event"])
	onContentScoll(event: ScrollEvent) {
		//console.log("ionScroll", event); //{ contentHeight: event.contentHeight, scrollHeight: event.scrollHeight });
		//this.checkTabsPlacment();

		/*if(!this.initiated) {
			this.initiated = true;
			this.init();
			this.content.resize();
		}*/


		let maxScrollTop = event.scrollHeight - (event.contentTop + event.contentHeight + event.contentBottom);
		


		var duration = 0;
		let scrollTop = event.scrollTop;
		let scrollTopDiff = scrollTop - this.scrollTopPrev;

		let y = (scrollTop >= 0) ? constrain(this.yPrev + scrollTopDiff, 0, this.defaultEnd) : 0;

		

		//if we are at the bottom, animate the header/tabs back in
		//if (scrollView.getScrollMax().top - scrollTop <= contentTop) {
		// if (scrollTop >= maxScrollTop) {
		// 	y = 0;
		// 	duration = this.defaultDuration;
		// }

		this.scrollTopPrev = scrollTop;

		//if previous and current y are the same, no need to continue
		if (this.yPrev === y) {
			return;
		}
		this.yPrev = y;



		//console.log({ y: y, scrollTop: event.scrollTop, maxScrollTop: maxScrollTop});
		

		this.modifyDom(y * 1.0, duration, event.domWrite);
	}
	


	private modifyDom(y: number, duration: number, dowWrite: DomWrite) {
		dowWrite(() => {

			// Header Items
			this.headerItems.forEach((item) => {

				let dy = constrain((y - item.startY), 0, (this.endY - item.startY));
				
				if(item.type === ItemType.Tabbar) {
					var val = constrain((dy / this.content._tabbarHeight), 0, 1);

					console.log("val:", val);

					let height = this.content._tabbarHeight * (1 - val);
					if(height >= 0) {
						$(item.ele).css("height", height + "px");	
						$(item.ele).css("display", "");																
					} else {
						$(item.ele).css("display", "none");		
					}

				} else {
					var val = constrain((dy / item.ele.offsetHeight), 0, 1);
					
					this.translateElementY(item.ele, -dy, duration);
				}
				if(item.shrinkable) {	
					//let fadeAmt = constrain(1 - (dy / item.ele.offsetHeight), 0, 1);		
					let fadeAmt = 1 - val;

					$(item.ele).children().not(".toolbar-background")
						.each((index, navbarChild) => {
							$(navbarChild).css("opacity", fadeAmt);
						});
				}
			});


			
			// Footer Items
			this.footerItems.forEach((item) => {
				this.translateElementY(item.ele, y, duration);				
			});
		});
	}

	private translateElementY(ele: HTMLElement, y: number, duration: number) {
		this.renderer.setElementStyle(ele, "webkitTransform", `translate3d(0, ${y}px,0)`);

		/*if (duration && !ele.style.transitionDuration) {
			ele.style.transitionDuration = duration + "ms";
			setTimeout(() => {
				ele.style.transitionDuration = "";
			}, this.defaultDelay);
		}*/
	}
}
