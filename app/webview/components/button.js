// components/button.js
class Button {
    constructor(label, onClick) {
        this.label = label;
        this.onClick = onClick;
    }

    render() {
        const buttonElement = document.createElement('button');
        buttonElement.textContent = this.label;
        buttonElement.addEventListener('click', this.onClick);
        return buttonElement;
    }
}