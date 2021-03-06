import Flatpickr from 'persianflatpickr';
import Persian from 'persianflatpickr/dist/l10n/fa';
import * as jd from 'persianflatpickr/dist/jdate.min.js';
import InputWidget from './InputWidget';

import {
  convertFormatToFlatpickr,
  convertFormatToMask,
  convertFormatToMoment,
  currentTimezone,
  formatDate,
  formatOffset,
  getDateSetting,
  getLocaleDateFormatInfo,
  momentDate,
  zonesLoaded,
  shouldLoadZones,
  loadZones
} from '../utils/utils';
import moment from 'jalali-moment';
import _ from 'lodash';
const DEFAULT_FORMAT = 'yyyy-MM-dd hh:mm a';
const ISO_8601_FORMAT = 'yyyy-MM-ddTHH:mm:ssZ';

export default class PersianCalendarWidget extends InputWidget {
  /* eslint-disable camelcase */
  static get defaultSettings() {
    return {
      type: 'persiancalendar',
      altInput: true,
      allowInput: true,
      clickOpens: true,
      enableDate: true,
      enableTime: true,
      mode: 'single',
      noCalendar: false,
      format: DEFAULT_FORMAT,
      dateFormat: ISO_8601_FORMAT,
      useLocaleSettings: false,
      language: 'fa',
      hourIncrement: 1,
      minuteIncrement: 5,
      time_24hr: false,
      saveAs: 'date',
      displayInTimezone: '',
      timezone: '',
      disable: [],
      minDate: '',
      maxDate: ''
    };
  }
  /* eslint-enable camelcase */

  constructor(settings, component) {
    super(settings, component);
    // Change the format to map to the settings.
    if (this.settings.noCalendar) {
      this.settings.format = this.settings.format.replace(/yyyy-MM-dd /g, '');
    }
    if (!this.settings.enableTime) {
      this.settings.format = this.settings.format.replace(/ hh:mm a$/g, '');
    }
    else if (this.settings.time_24hr) {
      this.settings.format = this.settings.format.replace(/hh:mm a$/g, 'HH:mm');
    }
    window.Date = jd.u;
    this.settings.locale = 'fa';
	this.settings.language = 'fa';
  }
  /**
   * Load the timezones.
   *
   * @return {boolean} TRUE if the zones are loading, FALSE otherwise.
   */
  loadZones() {
    const timezone = this.timezone;
    if (!zonesLoaded() && shouldLoadZones(timezone)) {
      loadZones(timezone).then(() => this.emit('redraw'));

      // Return zones are loading.
      return true;
    }

    // Zones are already loaded.
    return false;
  }

  attach(input) {
    const superAttach = super.attach(input);
    if (input && !input.getAttribute('placeholder')) {
      input.setAttribute('placeholder', this.settings.format);
    }

    const dateFormatInfo = getLocaleDateFormatInfo(this.settings.language);
    this.defaultFormat = {
      date: dateFormatInfo.dayFirst ? 'd/m/Y ' : 'm/d/Y ',
      time: 'G:i K'
    };

    this.closedOn = 0;
    this.valueFormat = this.settings.dateFormat || ISO_8601_FORMAT;

    this.valueMomentFormat = convertFormatToMoment(this.valueFormat);
    this.settings.minDate = getDateSetting(this.settings.minDate);
    this.settings.disable = this.disabledDates;
    this.settings.disableWeekends ? this.settings.disable.push(this.disableWeekends) : '';
    this.settings.disableWeekdays ? this.settings.disable.push(this.disableWeekdays) : '';
    this.settings.disableFunction ? this.settings.disable.push(this.disableFunction) : '';
    this.settings.maxDate = getDateSetting(this.settings.maxDate);
    this.settings.wasDefaultValueChanged = false;
    this.settings.defaultValue = '';
    this.settings.altFormat = convertFormatToFlatpickr(this.settings.format);
    this.settings.dateFormat = convertFormatToFlatpickr(this.settings.dateFormat);
    this.settings.onChange = () => this.emit('update');
    this.settings.onClose = () => {
      this.closedOn = Date.now();
      if (this.settings.wasDefaultValueChanged) {
        this.calendar._input.value = this.settings.defaultValue;
      }
      if (this.calendar) {
        this.emit('blur');
      }
    };
    this.settings.formatDate = (date, format) => {
      // Only format this if this is the altFormat and the form is readOnly.
      if (this.settings.readOnly && (format === this.settings.altFormat)) {
        if (this.settings.saveAs === 'text' || !this.settings.enableTime || this.loadZones()) {
          return Flatpickr.formatDate(date, format);
        }

        return formatOffset(Flatpickr.formatDate.bind(Flatpickr), date, format, this.timezone);
      }

      return Flatpickr.formatDate(date, format);
    };

	this.settings.language = 'fa';

    if (this._input) {
      // Create a new flatpickr.
      this.calendar = new Flatpickr(this._input, this.settings);

      this.calendar.altInput.addEventListener('input', (event) => {
        if (event.target.value === '') {
          this.settings.wasDefaultValueChanged = true;
          this.settings.defaultValue = event.target.value;
          this.calendar.clear();
        }
      });

      if (!this.settings.readOnly) {
        // Enforce the input mask of the format.
        this.setInputMask(this.calendar._input, convertFormatToMask(this.settings.format));
      }

      // Make sure we commit the value after a blur event occurs.
      this.addEventListener(this.calendar._input, 'blur', () =>
        this.calendar.setDate(this.calendar._input.value, true, this.settings.altFormat)
      );
    }
    return superAttach;
  }

  get disableWeekends() {
    return (date) => (date.getDay() === 0 || date.getDay() === 6);
  }

  get disableWeekdays() {
    return (date) => !this.disableWeekends(date);
  }

  get disableFunction() {
    return (date) => this.evaluate(`return ${this.settings.disableFunction}`, {
      date
    });
  }

  get timezone() {
    if (this.settings.timezone) {
      return this.settings.timezone;
    }
    if (this.settings.displayInTimezone === 'submission' && this.settings.submissionTimezone) {
      return this.settings.submissionTimezone;
    }
    if (this.settings.displayInTimezone === 'utc') {
      return 'UTC';
    }

    // Return current timezone if none are provided.
    return currentTimezone();
  }

  get defaultSettings() {
    return PersianCalendarWidget.defaultSettings;
  }

  addSuffix(suffix) {
    this.addEventListener(suffix, 'click', () => {
      if (this.calendar && !this.calendar.isOpen && ((Date.now() - this.closedOn) > 200)) {
        this.calendar.open();
      }
    });
    return suffix;
  }

  set disabled(disabled) {
    super.disabled = disabled;
    if (this.calendar) {
      if (disabled) {
        this.calendar._input.setAttribute('disabled', 'disabled');
      }
      else {
        this.calendar._input.removeAttribute('disabled');
      }
      this.calendar.close();
      this.calendar.redraw();
    }
  }

  get input() {
    return this.calendar ? this.calendar.altInput : null;
  }

  get disabledDates() {
    if (this.settings.disabledDates) {
      const disabledDates = this.settings.disabledDates.split(',');
      return disabledDates.map((item) => {
        const dateMask = /\d{4}-\d{2}-\d{2}/g;
        const dates = item.match(dateMask);
        if (dates.length) {
          return dates.length === 1 ? item.match(dateMask)[0] : {
            from: item.match(dateMask)[0],
            to: item.match(dateMask)[1],
          };
        }
      });
    }
    return [];
  }

  get localeFormat() {
    let format = '';

    if (this.settings.enableDate) {
      format += this.defaultFormat.date;
    }

    if (this.settings.enableTime) {
      format += this.defaultFormat.time;
    }

    return format;
  }

  get dateTimeFormat() {
    return this.settings.useLocaleSettings ? this.localeFormat : convertFormatToFlatpickr(this.dateFormat);
  }

  get dateFormat() {
    return _.get(this.settings, 'format', DEFAULT_FORMAT);
  }

	convertDatePickerTimeToMySQLTime(dateVal) {
		if (!dateVal) {
			return '';
		}

        var year, hours, minutes, seconds;
        var month = ['0' , ( dateVal.getMonth() + 1)].join('').slice(-2);
        var day = ['0' , dateVal.getDate()].join('').slice(-2);
        hours = ['0' , dateVal.getHours()].join('').slice(-2);
        minutes = ['0' , dateVal.getMinutes()].join('').slice(-2);
        seconds = ['0' , dateVal.getSeconds()].join('').slice(-3);

        var mySQLDate = [dateVal.getFullYear(), month, day].join('-');
        var mySQLTime = [hours, minutes, seconds].join(':');
		mySQLTime += 'Z';
        var res = [mySQLDate, mySQLTime].join('T');
		return res;
    }

  /**
   * Return the date value.
   *
   * @param date
   * @param format
   * @return {string}
   */
  getDateValue(date, format) {
	//return moment(date).format(convertFormatToMoment(format));

	//const newDate = moment(date, convertFormatToMoment(format)).locale('fa').format(convertFormatToMoment(format));
	//return newDate;

	var sqlDate = this.convertDatePickerTimeToMySQLTime(date._date);
	return sqlDate;
  }

  /**
   * Return the value of the selected date.
   *
   * @return {*}
   */
  getValue() {
    // Standard output format.
    if (!this.calendar) {
      return super.getValue();
    }

    // Get the selected dates from the calendar widget.
    const dates = this.calendar.selectedDates;
    if (!dates || !dates.length) {
      return super.getValue();
    }

    if (!(dates[0] instanceof Date)) {
      return 'Invalid Date';
    }

    const data = this.getDateValue(dates[0], this.valueFormat);
	return data;
  }

  /**
   * Set the selected date value.
   *
   * @param value
   */
  setValue(value) {
    if (!value) return;
    var format = convertFormatToMoment(this.valueMomentFormat);

	var mdate = moment(value, format);
	if (!mdate._isValid) {
		mdate = moment.utc(value).toISOString();
	}

    var date = moment(mdate, format).locale('fa').format(format);
	//var sqlDate = this.convertDatePickerTimeToMySQLTime(date._date);
    this.calendar.setDate(date);
  }

  getValueAsString(value, format) {
    format = format || this.dateFormat;
    if (this.settings.saveAs === 'text') {
      return this.getDateValue(value, format);
    }
    return formatDate(value, format, this.timezone);
  }

  validationValue(value) {
    if (typeof value === 'string') {
      return new Date(value);
    }
    return value.map(val => new Date(val));
  }

  destroy() {
    super.destroy();
    if (this.calendar) {
      this.calendar.destroy();
    }
  }
}
