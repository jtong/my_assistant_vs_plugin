class GradioApp {
    constructor() {
        this.components = [];
    }

    add(component) {
        this.components.push(component);
    }

    mount(rootElement) {
        this.components.forEach(component => {
            rootElement.appendChild(component.render());
        });
    }
}