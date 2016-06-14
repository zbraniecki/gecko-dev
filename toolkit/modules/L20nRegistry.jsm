
this.EXPORTED_SYMBOLS = ['L20nRegistry'];


const resSources = new Map();
const resIndex = new Map();

this.L20nRegistry = {
  registerSource() {

  }
}

const KintoSource = {
  resIndex: {
    'aboutDialog.ftl': {
      'pl': 'db://browser/pl/content/aboutDialog.ftl'
    }
  }
}

const BrowserFileSource = {
  resIndex: {
    'aboutDialog.ftl': {
      'pl': 'jar://browser-omni.jar/content/aboutDialog.ftl'
    }
  }
}

const ToolkitFileSource = {
  resIndex: {
    'aboutDialog.ftl': {
      'pl': 'jar://omni.jar/content/aboutDialog.ftl'
    },
    'brand.ftl': {
      'pl': 'jar://omni.jar/content/brand.ftl'
    }
  }
}

const LangpackSource = {
  resIndex: {
    'aboutDialog.ftl': {
      'pl': 'jar://pl-langpack@mozilla.org/content/aboutDialog.ftl'
    }
  }
}

const Langpack2Source = {
  resIndex: {
    'aboutDialog.ftl': {
      'pl': [2, 'jar://pl-langpack2@mozilla.org//content/aboutDialog.ftl']
    },
    'brand.ftl': {
      'pl': 'jar://pl-langpack2@mozilla.org/content/brand.ftl'
    }
  }
}


resSources = {
  'browser-file': BrowserFileSource,
  'toolkit-file': ToolkitFileSource,
  'kinto': KintoSource,
  'langpack': LangpackSource,
  'langpack2': Langpack2Source,
}


resIndex = {
  'aboutDialog.ftl': {
    'pl': [
      'kinto',
      'browser-file',
      'toolkit-file',
      'langpack',
      'langpack2',
    ]
  },
  'brand.ftl': {
    'pl': [
      'toolkit-file',
      'langpack2',
    ]
  }
}
