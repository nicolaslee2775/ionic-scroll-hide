import { 
	Directive,
	ElementRef, NgZone, HostListener, Input, Renderer,
	OnInit, OnDestroy,
} from '@angular/core';

import { Content, ScrollEvent, NavController, } from 'ionic-angular'


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



interface Item {
	ele: HTMLElement;
	startY: number;
	endY: number;
	unshrinkable: boolean;
}


@Directive({
	selector: '[scroll-hide]' // Attribute selector
})
export class ScrollHide implements OnInit, OnDestroy {
	
	@Input() navCtrl: NavController;

	initiated: boolean = false;

	contentTop: number;
	endY: number;

	//tabbarOnBottom: boolean = true;
	//tabbarEle: HTMLElement;
	headerItems: Item[] = [];
	footerItems: Item[] = [];


	constructor(private content: Content, 
				private renderer: Renderer,
				private zone: NgZone) {}
	

	ngOnInit() {
		this.content.fullscreen = true;

		//console.log("mode:", this.content._mode, "tabs:", this.content._tabs);
		console.log("ngOnInit() > navCtrl:", this.navCtrl)


		/*
		this.navCtrl.viewDidEnter.subscribe((event) => {
			//console.log("viewDidEnter > _tabsPlacement:", this.content._tabsPlacement);
			console.log("ScrollHide > viewDidEnter()", event);
		});
		this.navCtrl.viewWillLeave.subscribe((event) => {
			console.log("ScrollHide > viewWillLeave()", event);
		});
		*/
		


		let win: any = window;
		win.temp = win.temp || {};
		win.temp.content = this.content;
		win.temp.zone = this.zone;
	}

	ngOnDestroy() {
		console.log("ngOnDestroy()");
	}

	private init() {
		let contentEle: HTMLElement = this.content.getNativeElement();
		let headerEle = contentEle.parentElement.querySelector("ion-header");
		let footerEle = contentEle.parentElement.querySelector("ion-footer");
		if(headerEle) {
			this.headerItems = [];
			for(var i = 0; i < headerEle.children.length; i++) {
				this.headerItems[i] = {
					ele: <HTMLElement> headerEle.children[i],
					startY: 0,
					endY: 0,
					unshrinkable: false
				};
			}
		}
		if(footerEle) {
			this.footerItems = [];
			for(var i = 0; i < footerEle.children.length; i++) {
				this.footerItems[i] = {
					ele: <HTMLElement> footerEle.children[i],
					startY: 0,
					endY: 0,
					unshrinkable: false
				};
			}
		}




		let hasTabbar = (this.content._tabs !== null);
		if(hasTabbar) {
			//this.tabbarEle = this.content._tabs._tabbar.nativeElement;
			let tabbarEle = <HTMLElement> (<any> this.content._tabs)._tabbar.nativeElement;

			if(this.content._tabsPlacement === "bottom") {
				this.footerItems.push({
					ele: tabbarEle,
					startY: 0,
					endY: 0,
					unshrinkable: false
				});
			} else {
				this.headerItems.push({
					ele: tabbarEle,
					startY: 0,
					endY: 0,
					unshrinkable: false
				});
			}
		}


		this.headerItems = this.headerItems.reverse();
		this.footerItems = this.footerItems.reverse();



		var contentTop = 0;

		console.group("headerItems")

		var shrinkableHeightSum = 0;
		this.headerItems.forEach((item, index) => {
			contentTop += item.ele.offsetHeight;
			
			//this.renderer.setElementStyle(item.ele, "z-index", this.headerItems.length - index + "");
			
			if(item.ele.classList.contains("tabbar")) {
				this.renderer.setElementStyle(item.ele, "overflow", "hidden");				
				forEach(item.ele.children, (tabButton) => {
					this.renderer.setElementStyle(tabButton, "align-self", "flex-end");					
				});
			} else {
				this.renderer.setElementStyle(item.ele, "z-index", (index + 1) + "");				
			}

			if(item.ele.tagName === "ION-NAVBAR") {
				this.renderer.setElementStyle(item.ele, "position", "relative")				
			}

 
			if(!item.ele.classList.contains("unshrinkable")) {
				item.startY = shrinkableHeightSum;
				item.endY = shrinkableHeightSum + item.ele.offsetHeight;
				item.unshrinkable = false;

				shrinkableHeightSum += item.ele.offsetHeight;
				
			} else {
				item.startY = shrinkableHeightSum;
				item.endY = shrinkableHeightSum;
				item.unshrinkable = true;				
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
			this.renderer.setElementStyle(headerEle, "pointer-events", "none");
			this.headerItems.forEach((item) => {
				this.renderer.setElementStyle(item.ele, "pointer-events", "all");
			});
		}
		if(footerEle) {
			this.renderer.setElementStyle(footerEle, "pointer-events", "none");
			this.footerItems.forEach((item) => {
				this.renderer.setElementStyle(item.ele, "pointer-events", "all");
			});
		}
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

		if(!this.initiated) {
			this.initiated = true;
			this.init();
			this.content.resize();
		}


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

				/*if(y < item.endY) {
					this.translateElementY(item.ele, -y, duration);	

					let dy = (y - item.startY);
					let fadeAmt = constrain(1 - (dy / item.ele.offsetHeight * 2), 0, 1);
					
					forEach(item.ele.children, (navbarChild) => {
						if(!navbarChild.classList.contains("toolbar-background")) {
							this.renderer.setElementStyle(navbarChild, "opacity", fadeAmt + "");
						}
					});

				} else {
					this.translateElementY(item.ele, -item.endY, duration);							
					// if(item.unshrinkable) {
					// 	this.translateElementY(item.ele, -item.endY, duration);		
					// } else {
					// 	this.translateElementY(item.ele, -item.endY - 100, duration);	
					// }
				}*/


				/*
				if(y <= this.endY) {
					if(item.startY <= y) {
						this.translateElementY(item.ele, -(y - item.startY), duration);	

						if(!item.unshrinkable) {
							let dy = (y - item.startY);
							let fadeAmt = constrain(1 - (dy / item.ele.offsetHeight), 0, 1);
							
							forEach(item.ele.children, (navbarChild) => {
								if(!navbarChild.classList.contains("toolbar-background")) {
									this.renderer.setElementStyle(navbarChild, "opacity", fadeAmt + "");
								}
							});
						}

					} else {
						this.translateElementY(item.ele, 0, duration);
					}
				} else {
					this.translateElementY(item.ele, -(this.endY - item.startY), duration);	
				}*/



				let dy = constrain((y - item.startY), 0, (this.endY - item.startY));
				
				if(item.ele.classList.contains("tabbar")) {
					var val = constrain((dy / this.content._tabbarHeight), 0, 1);

					console.log("val:", val);

					let height = this.content._tabbarHeight * (1 - val);
					if(height >= 0) {
						this.renderer.setElementStyle(item.ele, "height", height + "px");	
						this.renderer.setElementStyle(item.ele, "display", "");																
					} else {
						this.renderer.setElementStyle(item.ele, "display", "none");		
					}

				} else {
					var val = constrain((dy / item.ele.offsetHeight), 0, 1);
					
					this.translateElementY(item.ele, -dy, duration);
				}
				if(!item.unshrinkable) {	
					//let fadeAmt = constrain(1 - (dy / item.ele.offsetHeight), 0, 1);		
					let fadeAmt = 1 - val;
					forEach(item.ele.children, (navbarChild) => {
						if(!navbarChild.classList.contains("toolbar-background")) {
							this.renderer.setElementStyle(navbarChild, "opacity", fadeAmt + "");
						}
					});
					//item.ele.querySelectorAll("")
				}

				



				//this.translateElementY(item.ele, -y, duration);

				// if(item.ele.tagName === "ION-NAVBAR") {
				// 	var fadeAmt = 1 - (y / item.ele.offsetHeight);

				// 	forEach(item.ele.children, (navbarChild) => {
				// 		if(!navbarChild.classList.contains("toolbar-background")) {
				// 			this.renderer.setElementStyle(navbarChild, "opacity", fadeAmt + "");
				// 			//if (scaleHeaderElements) {
				// 			//	this.renderer.setElementStyle(navbarChild, "transform", `scale(${fadeAmt}, ${fadeAmt})`);								
				// 			//}
				// 		}
				// 	});
				// }
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

	private translateElementHeight(ele: HTMLElement, height: number) {
		this.renderer.setElementStyle(ele, "height", `${height}px`);
	}
}
