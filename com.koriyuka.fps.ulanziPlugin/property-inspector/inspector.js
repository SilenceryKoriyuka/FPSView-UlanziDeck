// Settings page for every System Monitor action.
// Unchecked checkboxes are missing from form data, so they are sent explicitly as "off".

let form = null;

const CHECKBOXES = ['showGraph', 'colorCoding'];

function readForm() {
  const value = Utils.getFormValue(form);
  for (const name of CHECKBOXES) {
    value[name] = form.elements[name].checked ? 'on' : 'off';
  }
  return value;
}

function fillForm(params) {
  if (!params || !form) return;
  Utils.setFormValue(params, form);
  // setFormValue only ever ticks boxes, so untick the ones saved as off.
  for (const name of CHECKBOXES) {
    if (params[name] === 'off' || params[name] === false) form.elements[name].checked = false;
  }
}

$UD.connect();

$UD.onConnected(() => {
  form = document.querySelector('#property-inspector');
  document.querySelector('.uspi-wrapper').classList.remove('hidden');

  form.addEventListener('input', Utils.debounce(() => {
    $UD.sendParamFromPlugin(readForm());
  }));
});

$UD.onAdd(jsn => fillForm(jsn && jsn.param));
$UD.onParamFromApp(jsn => fillForm(jsn && jsn.param));
