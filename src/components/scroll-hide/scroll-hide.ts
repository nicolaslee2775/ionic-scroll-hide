import { 
	Directive,
	ElementRef, NgZone, HostListener, Input, Renderer,
	OnInit, OnDestroy,
} from '@angular/core';

import { Content, ScrollEvent, NavController, ViewController } from 'ionic-angular'
import { Subscription } from 'rxjs';

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
		
	public transition: Transition = { type: 0, start: 0, end: 0, interval: 0 };
	public scrollShrinkVal: number = 0;


	constructor(public ele: HTMLElement) {

		if(ele.classList.contains("tabbar")) {
			this.type = ItemType.Tabbar;
		} else if(ele.tagName === "ION-NAVBAR") {
			this.type = ItemType.Navbar;
		} else {
			this.type = ItemType.Toolbar;
		}

		this.height = ele.offsetHeight;
		Subscription


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
			
			//this.transition.type = TransitionType.Translate;

			//this.transition.type = TransitionType.Static;
		}
	}

}


@Directive({
	selector: '[scroll-hide]' // Attribute selector
})
export class ScrollHide implements OnInit, OnDestroy {
	
	@Input("scroll-hide") viewCtrl: ViewController;

	
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


	initiated: boolean = false;
	viewEntered: boolean = false;

	//---------------------------------

	subscriptions: Subscription[] = [];

	//---------------------------------

	constructor(private content: Content, 
				private renderer: Renderer,
				private zone: NgZone) {}
	
	

	ngOnInit() {
		this.content.fullscreen = true;
		

		// ViewCtrl LifeCycle
		this.subscriptions.push(
			this.viewCtrl.didEnter.subscribe(() => {
				this.init();
			})
		);
		this.subscriptions.push(
			this.viewCtrl.willLeave.subscribe(() => {		
				this.resetStyle();
			})
		);



		// Content Scroll Event
		var prevEndTimestep: number = 0;
		this.subscriptions.push(
			this.content.ionScroll.subscribe(event => {
				if(event.timeStamp > prevEndTimestep + 200) { // prevent multiple triggered of scroll event
					this.onContentScroll(event, false);
				}
			})
		);
		this.subscriptions.push(
			this.content.ionScrollEnd.subscribe(event => {
				if(event.timeStamp > prevEndTimestep + 200) {
					this.onContentScroll(event, true);
				}
				prevEndTimestep = event.timeStamp;			
			})
		);
	}

	ngOnDestroy() {
		console.log("ngOnDestroy()");

		this.resetStyle();


		this.viewCtrl = null;
		
		this.headerItems = null;
		this.footerItems = null;

		this.headerEle = null;
		this.footerEle = null;

		this.subscriptions.forEach(sub => sub.unsubscribe());
		this.subscriptions = null;
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

		//console.group("headerItems")

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
			
			//console.log(item, item.ele.offsetHeight);
		});
		this.headerHeight = headerHeight;
		this.defaultEnd = this.headerHeight * 2;
		this.endY = shrinkableHeightSum;

		//console.groupEnd();


		//console.group("footerItems")
		this.footerItems.forEach(item => {
			footerHeight += item.ele.offsetHeight;
			//console.log(item.ele, item.ele.offsetHeight);
		});
		this.footerHeight = footerHeight;
		//console.groupEnd();
		
		//console.log("headerHeight:", headerHeight, ", footerHeight:", footerHeight, ", endY:", this.endY);


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
			$(item.ele).css("min-height", "");	
			$(item.ele).css("webkitTransform", "");


			if(item.type !== ItemType.Tabbar) {

				$(item.ele).css("marginBottom", "");

				if(item.transition.type === TransitionType.Shrink) {
					// Shrinking
					$(item.ele).children().not(".toolbar-background, .toolbar-content")
						.each((index, navbarChild) => {
							$(navbarChild).css("transform", "");
						});
					$(item.ele).children(".toolbar-content").children()
						.each((index, navbarChild) => {
							$(navbarChild).css("transform", "");
						});
					
				} else {
					// Translating
					$(item.ele).children().not(".toolbar-background")
						.each((index, navbarChild) => {
							$(navbarChild).css("opacity", "");
						});
				}
					
			}
		});


		// Footer Items
		this.footerItems.forEach((item) => {
			$(item.ele).css("webkitTransform", "");				
		});


		// Content
		this.content.setScrollElementStyle("padding-bottom", (this.content._pBottom) + "px");		
	}


	/*cachedTabbarStayle: {
		top: string;
		height?: string;
		webkitTransform: string;
	};
	private storeTabbarStyle() {
		console.log("storeTabbarStyle()");

		this.headerItems.forEach((item) => {
			if(item.type === ItemType.Tabbar) {
				this.cachedTabbarStayle = {
					top: 			 $(item.ele).css("top"),
					height: 		 $(item.ele).css("height"),	
					webkitTransform: $(item.ele).css("webkitTransform")
				};
			}
		});
		this.footerItems.forEach((item) => {
			if(item.type === ItemType.Tabbar) {
				this.cachedTabbarStayle = {
					top: 			 $(item.ele).css("top"),
					webkitTransform: $(item.ele).css("webkitTransform")
				};
			}				
		});
		console.log("this.cachedTabbarStayle:", this.cachedTabbarStayle);
	}
	private resetTabbarStyle() {
		console.log("resetTabbarStyle()");
		
		this.headerItems.forEach((item) => {
			if(item.type === ItemType.Tabbar) {
				$(item.ele).css("overflow", "");
				$(item.ele).children().css("align-self", "center");

				$(item.ele).css("height", "");	
				$(item.ele).css("min-height", "");	
				$(item.ele).css("webkitTransform", "");
			}
		});
		this.footerItems.forEach((item) => {
			if(item.type === ItemType.Tabbar) {			
				$(item.ele).css("webkitTransform", "");
			}				
		});
	}
	private appplyStoredTabbarStyle() {
		console.log("appplyStoredTabbarStyle()");

		this.headerItems.forEach((item) => {
			if(item.type === ItemType.Tabbar) {
				$(item.ele).css("overflow", "hidden");
				$(item.ele).children().css("align-self", "flex-end");
				$(item.ele).css("min-height", "0");	

				$(item.ele).css("top", this.cachedTabbarStayle.top);
				$(item.ele).css("height", this.cachedTabbarStayle.height);
				$(item.ele).css("webkitTransform", this.cachedTabbarStayle.webkitTransform);
			}
		});
		this.footerItems.forEach((item) => {
			if(item.type === ItemType.Tabbar) {
				$(item.ele).css("top", this.cachedTabbarStayle.top);				
				$(item.ele).css("webkitTransform", this.cachedTabbarStayle.webkitTransform);
			}				
		});
	}*/

	
	
	hasStopMoving = false;
	hasClearStopMoving = false;

	extendBottom = false;
	hasReachBottomBefore = false;
	hasBeyondMaxScrollTop = false;


	onContentScroll(event: ScrollEvent, isMoveEnd: boolean) {

		// For Ionic 3
		let maxScrollTop = this.content._scrollContent.nativeElement.scrollHeight - (event.contentTop + event.contentHeight + event.contentBottom) - (this.extendBottom ? this.footerHeight : 0);
		// For Ionic 2
		//let maxScrollTop = this.content._scrollEle.scrollHeight - (event.contentTop + event.contentHeight + event.contentBottom) - (this.extendBottom ? this.footerHeight : 0); // For ionic2


		var duration = 0;
		let scrollTopDiff = event.scrollTop - this.scrollTopPrev;

		let y = (event.scrollTop >= 0) ? constrain(this.yPrev + scrollTopDiff, 0, this.defaultEnd) : 0;

		
		//console.log(event.scrollTop + ", maxScrollTop: " + maxScrollTop + ", isMoveEnd: " + isMoveEnd);



		//----------------------------------------------------------------------------------------
		
		if (event.scrollTop >= maxScrollTop) {
			if(this.hasReachBottomBefore) {
				//console.log("--> 1 show");				
				y = 0;
				duration = this.defaultDuration;
			}
			if(isMoveEnd) {
				//console.log("--> 1 extend padding-bottom");
				this.hasReachBottomBefore = true;
				this.extendBottom = true;
			}
		}
		

		// Reset bottom
		if (event.scrollTop < maxScrollTop - 40) {
			this.hasReachBottomBefore = false;
			this.extendBottom = false;			
			//console.log("--> reset padding-bottom");
		}
		
		// Set bottom height
		if(this.extendBottom) {
			this.content.setScrollElementStyle("padding-bottom", (this.content._pBottom + this.footerHeight) + "px");
		} else {
			this.content.setScrollElementStyle("padding-bottom", (this.content._pBottom) + "px");			
		}



		//----------------------------------------------------------------------------------------


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
			


			// Header Items
			this.headerItems.forEach((item) => {

				let dy_transit 	 = constrain((y - item.transition.start), 	0, 	item.transition.interval);
				let dy_move 	 = constrain((y - item.transition.end),		0, 	Infinity);		

				//console.log(y, "dy_transit:", dy_transit, "dy_move:", dy_move, TransitionType[item.transition.type]);

				if(item.type === ItemType.Tabbar) {		

					let val = constrain((dy_transit / item.height), 0, 1);																
					$(item.ele).css({
						height: item.height - dy_transit,
					})
					this.translateElementY(item.ele, -dy_move, duration);

				} else {

					if(item.transition.type === TransitionType.Shrink) {
						// Shrinking

						let val = constrain((dy_transit / item.height), 0, 1);																
						$(item.ele).css({
							height: 	   item.height - dy_transit,
							marginBottom:  0,	// marginBottom:  dy_transit,
						})
						this.translateElementY(item.ele, 0, duration);

						
						$(item.ele).children().not(".toolbar-background, .toolbar-content")
							.each((index, navbarChild) => {
								$(navbarChild).css("transform", `scale(${1 - val})`);
							});
						$(item.ele).children(".toolbar-content").children()
							.each((index, navbarChild) => {
								$(navbarChild).css("transform", `scale(${1 - val})`);
							});
						
					} else {
						// Translating
					
						let val = constrain((dy_transit / item.height), 0, 1);																
						
						$(item.ele).css({
							height: 	   item.height,
							marginBottom:  -dy_transit, // marginBottom:  0,
						})
						this.translateElementY(item.ele, -dy_transit, duration);


						$(item.ele).children().not(".toolbar-background")
							.each((index, navbarChild) => {
								$(navbarChild).css("opacity", 1 - val);
							});
					}
						

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

		if (duration && !ele.style.transitionDuration) {
			ele.style.transitionDuration = duration + "ms";
			setTimeout(() => {
				ele.style.transitionDuration = "";
			}, this.defaultDelay);
		}
	}
}
