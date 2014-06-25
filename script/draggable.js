define([
	'jquery'
], function (jQuery) {
	// http://www.coderholic.com/jquery-draggable-implementation/
	// Make an element draggable using jQuery
	var makeDraggable = function(element) {
		element = jQuery(element);

		// Move the element by the amount of change in the mouse position
		var move = function(event) {
			if(element.data('mouseMove')) {
				var changeX = event.clientX - element.data('mouseX');
				var changeY = event.clientY - element.data('mouseY');

				var newX = parseInt(element.css('left')) + changeX;
				var newY = parseInt(element.css('top')) + changeY;

				element.css('left', newX);
				element.css('top', newY);

				element.data('mouseX', event.clientX);
				element.data('mouseY', event.clientY);
			}
		}

		element.mousedown(function(event) {
			element.data('mouseMove', true);
			element.data('mouseX', event.clientX);
			element.data('mouseY', event.clientY);
		});

		element.parents(':last').mouseup(function() {
			element.data('mouseMove', false);
		});

		element.mouseout(move);
		element.mousemove(move);
	};
	return makeDraggable;
});
