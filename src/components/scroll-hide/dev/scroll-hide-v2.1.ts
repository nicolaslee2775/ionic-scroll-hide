import { 
	Directive,
	ElementRef, NgZone, HostListener, Input, Renderer,
	OnInit, OnDestroy,
} from '@angular/core';

import { Content, ScrollEvent, NavController, ViewController } from 'ionic-angular'


import * as $ from 'jquery'


/*


	ion-header {
		pointer-events: none;
	}
	ion-header > * {
		pointer-events: all;
	}




	ion-header > ion-navbar {
		position: relative;
	}



	ion-tabs > .tabbar {
		overflow: hidden;
	}
	ion-tabs > .tabbar > *{
		align-self: flex-end;
	}

*/


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
	public height: number;	
	public shrinkable: boolean;
	public scrollShrinkVal: number;

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

		this.height = ele.offsetHeight;
		this.shrinkable = !ele.classList.contains("unshrinkable");

		var scrollShrinkVal = parseFloat($(ele).attr("scroll-hide-val"));		
		if(this.shrinkable) {
			if(isNaN(scrollShrinkVal)) scrollShrinkVal = 1;
		} else {
			scrollShrinkVal = 0;
		}
		this.scrollShrinkVal = scrollShrinkVal;
	}

	setY(startY: number, endY: number) {
		this.startY = startY;
		this.endY = endY;
	}

	setStartY(startY: number) {
		this.startY = startY;
	}
	setEndY(endY: number) {
		this.endY = endY;
	}
	
}


@Directive({
	selector: '[scroll-hide]' // Attribute selector
})
export class ScrollHide implements OnInit, OnDestroy {
	
	@Input() navCtrl: NavController;
	@Input() viewCtrl: ViewController;

	
	headerItems: Item[] = [];
	footerItems: Item[] = [];

	headerEle: HTMLElement;
	footerEle: HTMLElement;

	//---------------------------------

	defaultDelay: number = 400 * 2;
	defaultDuration: number = 400;


	headerHeight: number;
	footerHeight: number;
	endY: number;

	defaultEnd: number = 0;
	y: number = 0;
	yPrev: number = 0;
	scrollTopPrev: number = 0;

	//---------------------------------


	constructor(private content: Content, 
				private renderer: Renderer,
				private zone: NgZone) {}
	

	ngOnInit() {
		this.content.fullscreen = true;
		

		//console.log("ngOnInit() > navCtrl:", this.navCtrl);
		//console.log("ngOnInit() > viewCtrl:", this.viewCtrl);


		this.viewCtrl.didEnter.subscribe(() => {
			//console.log("ScrollHide > viewCtrl.didEnter(), _tabsPlacement:", this.content._tabsPlacement);
			console.log("init()");
			this.init();
		});
		this.viewCtrl.willLeave.subscribe(() => {
			console.log("resetStyle()");			
			this.resetStyle();
		});


		this.content.ionScroll.subscribe(event => {
			this.onContentScroll(event, false);
		});
		this.content.ionScrollEnd.subscribe(event => {
			console.log("ionScrollEnd!");
			this.onContentScroll(event, true);
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



		this.content.resize();


		let contentEle = <HTMLElement> this.content.getNativeElement();
		let headerEle  = <HTMLElement> contentEle.parentElement.querySelector("ion-header");
		let footerEle  = <HTMLElement> contentEle.parentElement.querySelector("ion-footer");
		
		if(headerEle) {
			this.headerItems = $(headerEle)
				.children()
				.toArray().map(ele => new Item(ele));
		} else {
			this.headerItems = [];			
		}
		
		if(footerEle) {
			this.footerItems = $(footerEle)
				.children()
				.toArray().map(ele => new Item(ele));
		} else {
			this.footerItems = [];
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

		


		var headerHeight = 0,
			footerHeight = 0;

		console.group("headerItems")

		var shrinkableHeightSum = 0;
		this.headerItems.forEach((item, index) => {
			headerHeight += item.ele.offsetHeight;

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


			// For shrinking
			$(item.ele).css("padding-top", "0");			
			$(item.ele).css("padding-bottom", "0");			


			
			if(item.shrinkable) {
				item.setStartY(shrinkableHeightSum);
				//item.setEndY(shrinkableHeightSum + (item.height * (1 - item.scrollShrinkVal)));			
				//shrinkableHeightSum += item.height * (1 - item.scrollShrinkVal);
				item.setEndY(shrinkableHeightSum + (item.height * (item.scrollShrinkVal)));							
				shrinkableHeightSum += item.height * item.scrollShrinkVal;
				//item.setEndY(shrinkableHeightSum + shrinkHeight);			
				//shrinkableHeightSum += shrinkHeight;
			} else {
				item.setStartY(shrinkableHeightSum);
				item.setEndY(shrinkableHeightSum);
				//shrinkableHeightSum += item.height;
			}
			
			console.log(item, item.ele.offsetHeight);
		});
		this.headerHeight = headerHeight;
		this.defaultEnd = this.headerHeight * 2;
		this.endY = shrinkableHeightSum;

		console.groupEnd();


		console.group("footerItems")
		this.footerItems.forEach(item => {
			footerHeight += item.ele.offsetHeight;
			console.log(item.ele, item.ele.offsetHeight);
		});
		this.footerHeight = footerHeight;
		console.groupEnd();
		
		console.log("headerHeight:", headerHeight, ", footerHeight:", footerHeight, ", endY:", this.endY);


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






	hasScrollToBottomBefore = false;


	//@HostListener("ionScroll", ["$event", "false"])
	onContentScroll(event: ScrollEvent, isMoveEnd: boolean) {
		//console.log("ionScroll", event); //{ contentHeight: event.contentHeight, scrollHeight: event.scrollHeight });
		//this.checkTabsPlacment();

		/*if(!this.initiated) {
			this.initiated = true;
			this.init();
			this.content.resize();
		}*/


		let maxScrollTop = event.scrollHeight - (event.contentTop + event.contentHeight + event.contentBottom);
		


		var duration = 0;
		let scrollTopDiff = event.scrollTop - this.scrollTopPrev;

		let y = (event.scrollTop >= 0) ? constrain(this.yPrev + scrollTopDiff, 0, this.defaultEnd) : 0;

		

		//if we are at the bottom, animate the header/tabs back in
		if (event.scrollTop >= maxScrollTop - this.footerHeight) {

			if(this.hasScrollToBottomBefore) {
				y = 0;
				duration = this.defaultDuration;
			}

			if(isMoveEnd) {
				this.hasScrollToBottomBefore = true;
				this.content.setScrollElementStyle("padding-bottom", (this.content._pBottom + this.footerHeight) + "px");
			}

		} else {
			this.hasScrollToBottomBefore = false;		
			this.content.setScrollElementStyle("padding-bottom", (this.content._pBottom) + "px");
		}


		/*console.log({
			y: y, 
			endY: this.endY, 

			scrollTop: event.scrollTop,
			maxScrollTop: maxScrollTop,
			footerHeight: this.footerHeight,
		}, isMoveEnd);*/





		//if previous and current y are the same, no need to continue
		if (this.yPrev !== y) {
			//this.modifyDom(y, duration, event.domWrite);

			let yDiff = y - this.yPrev;
			if(-30 < yDiff && yDiff < 30) {
				this.modifyDom(y, duration, event.domWrite);			
			} else {
				this.modifyDom(y, 200, event.domWrite);
			}
		}

		//console.log({ y: y, scrollTop: event.scrollTop, maxScrollTop: maxScrollTop});
		

		this.yPrev = y;	
		this.scrollTopPrev = event.scrollTop;			
	}
	


	private modifyDom(y: number, duration: number, dowWrite: DomWrite) {
		dowWrite(() => {
			y = constrain(y, 0, this.endY);
			

			console.group();


			// Header Items
			this.headerItems.forEach((item) => {

				//let dy = constrain((y - item.startY), 0, Infinity);
				//let val = constrain((dy / item.height), 0, 1);										
				
				if(item.type === ItemType.Tabbar) {
					let dy = constrain((y - item.startY), 0, Infinity);
					let val = constrain((dy / item.height), 0, 1);										
					
					//var val = constrain((dy / this.content._tabbarHeight), 0, 1);

					console.log("val:", val);

					let height = this.content._tabbarHeight * (1 - val);
					if(height >= 0) {
						$(item.ele).css("height", height + "px");	
						$(item.ele).css("display", "");																
					} else {
						$(item.ele).css("display", "none");		
					}

				} else {
					let dy_shrink = constrain((y - item.startY), 0, item.endY - item.startY);
					let dy_translate = constrain((y - item.endY), 0, Infinity);
					
					//var val = constrain((dy / item.height), 0, 1);										
					
					//this.translateElementY(item.ele, -dy, duration);
					//if(item.scrollShrinkVal === 0.3) 
					console.log(y, "shrink:", dy_shrink, "tranalate:", dy_translate);

					if(y <= item.endY) {
						let val = constrain((dy_shrink / item.height), 0, 1);																
						$(item.ele).css({
							height: item.height - dy_shrink,
							minHeight: item.height - dy_shrink,
							marginBottom: dy_shrink,
						})
						this.translateElementY(item.ele, 0, duration);
					} else {
						//this.translateElementY(item.ele, -dy, duration);
						let val = constrain((dy_translate / item.height), 0, 1);																
						
						$(item.ele).css({
							height: item.height - (item.endY - item.startY),
							minHeight: item.height - (item.endY - item.startY),
							marginBottom: (item.endY - item.startY),
						})
						this.translateElementY(item.ele, -dy_translate, duration);
					}
				}
				/*if(item.shrinkable) {	
					//let fadeAmt = constrain(1 - (dy / item.ele.offsetHeight), 0, 1);		
					let fadeAmt = 1 - val;

					$(item.ele).children().not(".toolbar-background")
						.each((index, navbarChild) => {
							$(navbarChild).css("opacity", fadeAmt);
						});
				}*/
			});
			console.groupEnd();

			
			// Footer Items
			this.footerItems.forEach((item) => {
				this.translateElementY(item.ele, y, duration);				
			});


			// Content
			/*if(y <= this.endY) {
				this.content.setScrollElementStyle("margin-top", (this.headerHeight - y) + "px");
			} else {
				this.content.setScrollElementStyle("margin-top", (this.headerHeight - this.endY) + "px");				
			}

			if(y <= this.footerHeight) {
				this.content.setScrollElementStyle("margin-bottom", (this.footerHeight - y) + "px");
			}*/
		});
	}

	private translateElementY(ele: HTMLElement, y: number, duration: number) {
		this.renderer.setElementStyle(ele, "webkitTransform", `translate3d(0, ${y}px,0)`);

		if (duration && !ele.style.transitionDuration) {
			ele.style.transitionDuration = duration + "ms";
			setTimeout(() => {
				ele.style.transitionDuration = "";
			}, this.defaultDelay);
		}
	}
}
