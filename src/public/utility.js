export function formatDate(dateString) {
    if (!dateString || isNaN(Date.parse(dateString))) {
        return dateString;
    }

    const date = new Date(dateString);
    const day = date.getDate();
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const month = monthNames[date.getMonth()];
    const year = date.getFullYear();

    return `${day}. ${month} ${year}`;
}

export function isDatePassed(eolDate) {
    if (!eolDate || isNaN(Date.parse(eolDate))) {
        return null;
    }

    const today = new Date();
    const eol = new Date(eolDate);
    return today > eol;
}

export function getTimeDifferenceMessage(eolDate) {
    if (!eolDate || isNaN(Date.parse(eolDate))) {
        return '';
    }

    const today = new Date();
    const eol = new Date(eolDate);

    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const eolStart = new Date(eol.getFullYear(), eol.getMonth(), eol.getDate());

    const timeDifference = eolStart - todayStart;

    const days = Math.ceil(timeDifference / (1000 * 60 * 60 * 24));

    if (timeDifference > 0) {
        return `(Ends in ${days} day${days !== 1 ? 's' : ''})`;
    } else if (timeDifference = 0) {
        return `(Ends today : ''})`;
    } else {
        return `(Ended ${Math.abs(days)} day${Math.abs(days) !== 1 ? 's' : ''} ago)`;
    }
}