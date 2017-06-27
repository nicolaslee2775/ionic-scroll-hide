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





enum ItemType { Navbar, Toolbar, Tabbar }

enum TransitionType { Static, Translate, Shrink }
interface Transition {
	type: TransitionType;
	start: number;
	end: number;
	interval: number;
}

/*
 * 	  startY		   EndY
 *    shrinkStart	TransitionStart		MoveStart
 *		| ------------- | ---------------- | ---------->
 *			Shrink			Translate 	
 *
 * 
 * 	 transitionStart	transitionEnd
 *			| ------------- | ---------->
 *		 		Shrink
 *
 * 	 transitionStart	transitionEnd
 *			| ------------- | ---------->
 *		 		Translate
 *		
 */
class Item {
	public type: ItemType;
	public height: number;
	//public paddingTop: number;
	//public paddingBottom: number;

	//public static: boolean;
	public transition: Transition = { type: 0, start: 0, end: 0, interval: 0 };
	public scrollShrinkVal: number = 0;

	//public transitionStart = 0;
	//public transitionEnd = 0;
	//public transitionInterval = 0;

	constructor(public ele: HTMLElement) {

		if(ele.classList.contains("tabbar")) {
			this.type = ItemType.Tabbar;
		} else if(ele.tagName === "ION-NAVBAR") {
			this.type = ItemType.Navbar;
		} else {
			this.type = ItemType.Toolbar;
		}

		this.height = ele.offsetHeight;


		let shrinkable = ele.hasAttribute("scroll-hide-shrink");
		let translatable = ele.hasAttribute("scroll-hide-translate");

		if(shrinkable) {
			this.transition.type = TransitionType.Shrink;
			var scrollShrinkVal = parseFloat(ele.getAttribute("scroll-hide-shrink"));		
			if(isNaN(scrollShrinkVal)) scrollShrinkVal = 1;
			this.scrollShrinkVal = scrollShrinkVal;
			
		} else if(translatable) {
			this.transition.type = TransitionType.Translate;
			
		} else {			
			this.transition.type = TransitionType.Static;

		}


		if(this.type === ItemType.Tabbar) {
			this.transition.type = TransitionType.Shrink;
			this.scrollShrinkVal = 0.5;
			
			//this.transition = ItemTransition.Translate;

			//this.transition = ItemTransition.Static;
		}
	}

	
	
	/*setTransitionStart(transitionStart: number) {
		this.transitionStart = transitionStart;
	}
	setTransitionEnd(transitionEnd: number) {
		this.transitionEnd = transitionEnd;
	}
	setTransitionInterval(transitionInterval: number) {
		this.transitionInterval = transitionInterval;
	}*/
	
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
			//$(item.ele).css("padding-top", "0");			
			//$(item.ele).css("padding-bottom", "0");

				
			$(item.ele).css("min-height", "0");		
			$(item.ele).css("height", item.height + "px");	


			switch(item.transition.type) {

			case TransitionType.Shrink:

				let shrinkHeight = (item.height * item.scrollShrinkVal);
				item.transition.start 	 = (shrinkableHeightSum);
				item.transition.end 	 = (shrinkableHeightSum + shrinkHeight);
				item.transition.interval = (shrinkHeight);
				shrinkableHeightSum += (shrinkHeight);
				break;

			case TransitionType.Translate:

				item.transition.start 	 = (shrinkableHeightSum);
				item.transition.end 	 = (shrinkableHeightSum + item.height);
				item.transition.interval = (item.height);										
				shrinkableHeightSum += (item.height);				
				break;

			case TransitionType.Static:

				item.transition.start 	 = (shrinkableHeightSum);
				item.transition.end 	 = (shrinkableHeightSum);
				item.transition.interval = (0);														
				break;
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

			if(item.transition.type === TransitionType.Translate) {	
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


		console.log({
			y: y, 
			endY: this.endY, 

			scrollTop: event.scrollTop,
			maxScrollTop: maxScrollTop,
			footerHeight: this.footerHeight,
		});




		//if previous and current y are the same, no need to continue
		if (this.yPrev !== y) {
			//this.modifyDom(y, duration, event.domWrite);

			let yDiff = y - this.yPrev;
			if(-30 < yDiff && yDiff < 30) {
				this.modifyDom(y, duration, event.domWrite);			
			} else {
				this.modifyDom(y, 50, event.domWrite);
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

				let dy_transit 	 = constrain((y - item.transition.start), 	0, 	item.transition.interval);
				let dy_move 	 = constrain((y - item.transition.end),		0, 	Infinity);		

				console.log(y, "dy_transit:", dy_transit, "dy_move:", dy_move, TransitionType[item.transition.type]);

				if(item.type === ItemType.Tabbar) {
					//let dy_transit 	 = constrain((y - item.transition.start), 	0, 	item.transition.interval);
					//let dy_move 	 = constrain((y - item.transition.end),		0, 	Infinity);					
					
					
					if(y <= item.transition.end) {
						// Transiting

						if(item.transition.type === TransitionType.Shrink) {
							// Shrinking

							let val = constrain((dy_transit / item.height), 0, 1);																
							$(item.ele).css({
								height: item.height - dy_transit,
								//minHeight: item.height - dy_shrink,
								//marginBottom: dy_shrink,
							})
							this.translateElementY(item.ele, 0, duration);

						} else {
							// Translating
						
							let val = constrain((dy_transit / item.height), 0, 1);																
							$(item.ele).css({
								height: item.height - dy_transit,
								//minHeight: item.height - (item.translateStart - item.shrinkStart),
								//marginBottom: (item.translateStart - item.shrinkStart),
							})
							this.translateElementY(item.ele, 0, duration);
						}
						
					} else {
						// Moving					

						$(item.ele).css({
							height: item.height - item.transition.interval,
							//minHeight: item.height - (item.translateStart - item.shrinkStart),
							//marginBottom: (item.translateStart - item.shrinkStart),
						})
						this.translateElementY(item.ele, -dy_move, duration);
					}

				} else {

					if(y <= item.transition.end) {
						// Transiting

						if(item.transition.type === TransitionType.Shrink) {
							// Shrinking

							let val = constrain((dy_transit / item.height), 0, 1);																
							$(item.ele).css({
								height: 	   item.height - dy_transit,
								//minHeight:     item.height - dy_transit,
								marginBottom:  dy_transit,
								paddingTop:	   "",
								paddingBottom: "",
							})
							this.translateElementY(item.ele, 0, duration);


						} else {
							// Translating
						
							let val = constrain((dy_transit / item.height), 0, 1);																
							
							$(item.ele).css({
								height: 	   item.height,
								//minHeight: 	   item.height,
								marginBottom:  0,
								paddingTop:	   "",
								paddingBottom: "",
							})
							this.translateElementY(item.ele, -dy_transit, duration);
						}
						
					} else {
						// Moving		

						let val = constrain((dy_move / item.height), 0, 1);																

						$(item.ele).css({
							height: 	   item.height - item.transition.interval,
							//minHeight: 	   item.height - item.transition.interval,
							marginBottom:  item.transition.interval,
							paddingTop:    0,
							paddingBottom: 0,
						})
						this.translateElementY(item.ele, -dy_move, duration);
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
