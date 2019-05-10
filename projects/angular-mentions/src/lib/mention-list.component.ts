import {
  Component, ElementRef, Output, EventEmitter, ViewChild, Input, TemplateRef, OnInit
} from '@angular/core';

import { isInputOrTextAreaElement, getContentEditableCaretCoords } from './mention-utils';
import { getCaretCoordinates } from './caret-coords';

/**
 * Angular Mentions.
 * https://github.com/dmacfarlane/angular-mentions
 *
 * Copyright (c) 2016 Dan MacFarlane
 */
@Component({
  selector: 'mention-list',
  styles: [`
      :host{
        z-index: 1;
        user-select: none;
      }
      .scrollable-menu {
        margin-top: 20px;
        display: block;
        height: auto;
        max-height: 300px;
        overflow: auto;
      }
    `, `
      [hidden] {
        display: none;
      }
    `, `
      .dropdown-list-item.active {
        background-color: #f7f7f9;
      }
      .dropdown-list-item {
        padding: 8px;
        cursor: pointer;
        user-select: none;
        cursor: pointer;
        outline: 0;
        border: none;
        -webkit-tap-highlight-color: transparent;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        display: block;
        line-height: 48px;
        height: 48px;
        padding: 0 16px;
        text-align: left;
        text-decoration: none;
        max-width: 100%;
        position: relative;
        background: 0 0;
        color: rgba(0,0,0,.87);
        font-family: Roboto,"Helvetica Neue",sans-serif;
        font-size: 14px;
        font-weight: 400;
      }
      .dropdown-list-item a {
        cursor: pointer;
      }
      .dropdown-menu {
        /* background-color: #e0e0e0 */;
        background-color: white;
        list-style: none;
        box-shadow: 0 2px 4px -1px rgba(0,0,0,.2), 0 4px 5px 0 rgba(0,0,0,.14), 0 1px 10px 0 rgba(0,0,0,.12);
        border-radius: 4px;
        outline: 0;
        min-width: 112px;
        max-width: 280px;
        transform-origin: left top;
      }
      .menu-content {
        padding-top: 8px;
        padding-bottom: 8px;
      }
      .item-avatar {
        vertical-align: middle  ;
        margin-right: 8px;
        border-radius: 50px;
      }
    `],
  template: `
    <ng-template #defaultItemTemplate let-item="item">
    <img [src]="item.imagePath" width="34" height="34" *ngIf="item.imagePath" class="item-avatar">
    {{item['name'] && item['name'] || ''}} {{ item['name'] && ('(@'+item[labelKey] + ')' || item[labelKey])}}
    </ng-template>
    <div #list [hidden]="hidden" class="dropdown-menu scrollable-menu">
      <div class="menu-content">
        <div *ngFor="let item of items; let i = index" class="dropdown-list-item"
        [class.active]="activeIndex==i" (mousedown)="onMouseDown($event, i)" (mouseover)="activeIndex=i">
              <ng-template [ngTemplateOutlet]="itemTemplate" [ngTemplateOutletContext]="{'item':item}"></ng-template>
        </div>
      </div>
    </div>
    `
})
export class MentionListComponent implements OnInit {
  @Input() labelKey = 'label';
  @Input() itemTemplate: TemplateRef<any>;
  @Output() itemClick = new EventEmitter();
  @ViewChild('list') list: ElementRef;
  @ViewChild('defaultItemTemplate') defaultItemTemplate: TemplateRef<any>;
  items = [];
  activeIndex = 0;
  hidden = false;
  dropUp = false;
  private coords: { top: number, left: number } = { top: 0, left: 0 };
  private offset = 0;
  constructor(private element: ElementRef) { }

  ngOnInit() {
    if (!this.itemTemplate) {
      this.itemTemplate = this.defaultItemTemplate;
    }
  }
  onMouseDown(event, i) {
    this.activeIndex = i;
    this.itemClick.emit();
    event.preventDefault();
  }
  // lots of confusion here between relative coordinates and containers
  position(nativeParentElement: HTMLInputElement, iframe: HTMLIFrameElement = null) {
    if (isInputOrTextAreaElement(nativeParentElement)) {
      // parent elements need to have postition:relative for this to work correctly?
      this.coords = getCaretCoordinates(nativeParentElement, nativeParentElement.selectionStart, null);
      this.coords.top = nativeParentElement.offsetTop + this.coords.top - nativeParentElement.scrollTop;
      this.coords.left = nativeParentElement.offsetLeft + this.coords.left - nativeParentElement.scrollLeft;
      // getCretCoordinates() for text/input elements needs an additional offset to position the list correctly
      this.offset = this.getBlockCursorDimensions(nativeParentElement).height;
    } else if (iframe) {
      const context: { iframe: HTMLIFrameElement, parent: Element } = { iframe, parent: iframe.offsetParent };
      this.coords = getContentEditableCaretCoords(context);
    } else {
      const doc = document.documentElement;
      const scrollLeft = (window.pageXOffset || doc.scrollLeft) - (doc.clientLeft || 0);
      const scrollTop = (window.pageYOffset || doc.scrollTop) - (doc.clientTop || 0);
      // bounding rectangles are relative to view, offsets are relative to container?
      const caretRelativeToView = getContentEditableCaretCoords({ iframe });
      const parentRelativeToContainer: ClientRect = nativeParentElement.getBoundingClientRect();
      this.coords.top = caretRelativeToView.top - parentRelativeToContainer.top + nativeParentElement.offsetTop - scrollTop;
      this.coords.left = caretRelativeToView.left - parentRelativeToContainer.left + nativeParentElement.offsetLeft - scrollLeft;
    }
    // set the default/inital position
    this.positionElement();
  }

  get activeItem() {
    return this.items[this.activeIndex];
  }

  activateNextItem() {
    // adjust scrollable-menu offset if the next item is out of view
    const listEl: HTMLElement = this.list.nativeElement;
    const activeEl = listEl.getElementsByClassName('active').item(0);
    if (activeEl) {
      const nextLiEl: HTMLElement = activeEl.nextSibling as HTMLElement;
      if (nextLiEl && nextLiEl.className && nextLiEl.className.includes('dropdown-list-item')) {
        const nextLiRect: ClientRect = nextLiEl.getBoundingClientRect();
        if (nextLiRect.bottom > listEl.getBoundingClientRect().bottom) {
          listEl.scrollTop = nextLiEl.offsetTop + nextLiRect.height - listEl.clientHeight;
        }
      }
    }
    // select the next item
    this.activeIndex = Math.max(Math.min(this.activeIndex + 1, this.items.length - 1), 0);
  }

  activatePreviousItem() {
    // adjust the scrollable-menu offset if the previous item is out of view
    const listEl: HTMLElement = this.list.nativeElement;
    const activeEl = listEl.getElementsByClassName('active').item(0);
    if (activeEl) {
      const prevLiEl: HTMLElement = activeEl.previousSibling as HTMLElement;
      if (prevLiEl && prevLiEl.className && prevLiEl.className.includes('dropdown-list-item')) {
        const prevLiRect: ClientRect = prevLiEl.getBoundingClientRect();
        if (prevLiRect.top < listEl.getBoundingClientRect().top) {
          listEl.scrollTop = prevLiEl.offsetTop;
        }
      }
    }
    // select the previous item
    this.activeIndex = Math.max(Math.min(this.activeIndex - 1, this.items.length - 1), 0);
  }

  // reset for a new mention search
  reset() {
    this.list.nativeElement.scrollTop = 0;
    this.checkBounds();
  }

  // final positioning is done after the list is shown (and the height and width are known)
  // ensure it's in the page bounds
  private checkBounds() {
    let left = this.coords.left;
    const top = this.coords.top;
    let dropUp = this.dropUp;
    const bounds: ClientRect = this.list.nativeElement.getBoundingClientRect();
    // if off right of page, align right
    if (bounds.left + bounds.width > window.innerWidth) {
      left = (window.innerWidth - bounds.width - 10);
    }
    // if more than half off the bottom of the page, force dropUp
    // if ((bounds.top+bounds.height/2)>window.innerHeight) {
    //   dropUp = true;
    // }
    // if top is off page, disable dropUp
    if (bounds.top < 0) {
      dropUp = false;
    }
    // set the revised/final position
    this.positionElement(left, top, dropUp);
  }

  private positionElement(left: number = this.coords.left, top: number = this.coords.top, dropUp: boolean = this.dropUp) {
    const el: HTMLElement = this.element.nativeElement;
    top += dropUp ? 0 : this.offset; // top of list is next line
    el.className = dropUp ? 'dropup' : null;
    el.style.position = 'absolute';
    el.style.left = left + 'px';
    el.style.top = top + 'px';
  }

  private getBlockCursorDimensions(nativeParentElement: HTMLInputElement) {
    const parentStyles = window.getComputedStyle(nativeParentElement);
    return {
      height: parseFloat(parentStyles.lineHeight),
      width: parseFloat(parentStyles.fontSize)
    };
  }
}
