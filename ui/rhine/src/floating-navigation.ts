type IndicatorBounds = { x: number; y: number; width: number; height: number };

export class FloatingNavigation {
  private readonly plate = document.createElement("span");
  private readonly buttons: HTMLButtonElement[];
  private readonly observer: ResizeObserver;
  private readonly visibilityObserver: MutationObserver;
  private readonly systemMotion = matchMedia("(prefers-reduced-motion: reduce)");
  private animation: Animation | null = null;
  private selected = "";
  private reduced = false;
  private requestedReduced = false;
  private disposed = false;
  private bounds: IndicatorBounds | null = null;
  private motionX = 0;
  private motionY = 0;

  constructor(private readonly element: HTMLElement) {
    element.classList.add("floating-navigation");
    this.buttons = Array.from(element.querySelectorAll<HTMLButtonElement>("button[data-section]"));
    this.buttons.forEach(button => { button.type = "button"; });
    this.plate.className = "floating-navigation-plate";
    this.plate.setAttribute("aria-hidden", "true");
    element.prepend(this.plate);
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(element);
    this.visibilityObserver = new MutationObserver(() => {
      if (element.hidden) this.stopAnimation();
      else this.resize();
    });
    this.visibilityObserver.observe(element, { attributes: true, attributeFilter: ["hidden"] });
    element.addEventListener("keydown", this.onKeyDown);
    this.systemMotion.addEventListener("change", this.onSystemMotion);
  }

  select(section: string, reduced: boolean) {
    if (this.disposed || !this.buttons.some(button => button.dataset.section === section)) return;
    this.requestedReduced = reduced;
    reduced = reduced || this.systemMotion.matches;
    const changed = this.selected !== section;
    const motionChanged = this.reduced !== reduced;
    this.selected = section;
    this.reduced = reduced;
    if (reduced && motionChanged) this.stopAnimation();
    this.element.dataset.reduced = String(reduced);
    this.buttons.forEach(button => {
      button.setAttribute("aria-current", String(button.dataset.section === section));
    });
    if (reduced) this.setMotion(0, 0, true);
    if (changed || motionChanged || !this.bounds) this.position(changed && !reduced);
  }

  resize() {
    if (!this.disposed) this.position(false);
  }

  setMotion(x: number, y: number, reduced = this.reduced) {
    if (this.disposed) return;
    const clamp = (value: number) => Number.isFinite(value) ? Math.max(-1, Math.min(1, value)) : 0;
    const nextX = reduced ? 0 : Math.round(clamp(x) * 1200) / 1000;
    const nextY = reduced ? 0 : Math.round(clamp(y) * 1200) / 1000;
    if (this.motionX === nextX && this.motionY === nextY) return;
    this.motionX = nextX;
    this.motionY = nextY;
    this.element.style.setProperty("--nav-motion-x", `${nextX}px`);
    this.element.style.setProperty("--nav-motion-y", `${nextY}px`);
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.stopAnimation();
    this.observer.disconnect();
    this.visibilityObserver.disconnect();
    this.element.removeEventListener("keydown", this.onKeyDown);
    this.systemMotion.removeEventListener("change", this.onSystemMotion);
    this.element.classList.remove("floating-navigation");
    this.element.style.removeProperty("--nav-motion-x");
    this.element.style.removeProperty("--nav-motion-y");
    delete this.element.dataset.reduced;
    this.plate.remove();
  }

  private stopAnimation() {
    this.animation?.cancel();
    this.animation = null;
  }

  private readonly onSystemMotion = () => this.select(this.selected, this.requestedReduced);

  private position(animate: boolean) {
    const button = this.buttons.find(item => item.dataset.section === this.selected);
    if (!button || this.element.hidden || this.element.getClientRects().length === 0) {
      this.bounds = null;
      this.stopAnimation();
      return;
    }
    const navRect = this.element.getBoundingClientRect();
    const buttonRect = button.getBoundingClientRect();
    if (!buttonRect.width || !buttonRect.height) return;
    const bounds = {
      x: buttonRect.left - navRect.left - this.element.clientLeft,
      y: buttonRect.top - navRect.top - this.element.clientTop,
      width: buttonRect.width,
      height: buttonRect.height,
    };
    if (!animate && this.bounds && Object.keys(bounds).every(key => Math.abs(bounds[key as keyof IndicatorBounds] - this.bounds![key as keyof IndicatorBounds]) < .1)) return;
    const previous = this.bounds;
    const current = getComputedStyle(this.plate);
    // Read the rendered animation frame before cancelling a rapid switch.
    const from = { transform: current.transform, width: current.width, height: current.height };
    this.stopAnimation();
    this.bounds = bounds;
    const to = {
      transform: `translate3d(${bounds.x}px, ${bounds.y}px, 0)`,
      width: `${bounds.width}px`,
      height: `${bounds.height}px`,
    };
    Object.assign(this.plate.style, to);
    this.plate.hidden = false;
    if (!animate || !previous || this.reduced || !this.plate.animate) return;
    const animation = this.plate.animate([from, to], {
      duration: 260,
      easing: "cubic-bezier(.22, 1, .36, 1)",
    });
    this.animation = animation;
    void animation.finished.then(() => {
      if (this.animation === animation) this.animation = null;
    }, () => undefined);
  }

  private readonly onKeyDown = (event: KeyboardEvent) => {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    const index = this.buttons.indexOf(event.target as HTMLButtonElement);
    if (index === -1) return;
    const vertical = getComputedStyle(this.element).getPropertyValue("--nav-vertical").trim() === "1";
    const previousKey = vertical ? "ArrowUp" : "ArrowLeft";
    const nextKey = vertical ? "ArrowDown" : "ArrowRight";
    let next: number;
    if (event.key === previousKey) next = (index + this.buttons.length - 1) % this.buttons.length;
    else if (event.key === nextKey) next = (index + 1) % this.buttons.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = this.buttons.length - 1;
    else return;
    event.preventDefault();
    this.buttons[next].focus({ preventScroll: true });
  };
}
