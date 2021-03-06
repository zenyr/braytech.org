import React from 'react';
import { compose } from 'redux';
import { connect } from 'react-redux';
import { BrowserRouter, Route, Switch, Redirect } from 'react-router-dom';
import { withTranslation } from 'react-i18next';
import cx from 'classnames';

import moment from 'moment';
import 'moment/locale/de';
import 'moment/locale/es';
import 'moment/locale/fr';
import 'moment/locale/it';
// import 'moment/locale/ja';
import 'moment/locale/ko';
// import 'moment/locale/pl';
import 'moment/locale/pt-br';
// import 'moment/locale/ru';
import 'moment/locale/zh-cn';

import './Core.css';
import './App.css';
import './components/PresentationNode.css';

import './utils/i18n';
import dexie from './utils/dexie';
import * as bungie from './utils/bungie';
import * as voluspa from './utils/voluspa';
import * as ls from './utils/localStorage';
import GoogleAnalytics from './components/GoogleAnalytics';
import store from './store';
import manifest from './utils/manifest';

import Header from './components/UI/Header';
import Tooltip from './components/Tooltip';
import Footer from './components/UI/Footer';
import NotificationLink from './components/Notifications/NotificationLink';
import NotificationProgress from './components/Notifications/NotificationProgress';
import ServiceWorkerUpdate from './components/Notifications/ServiceWorkerUpdate';
import RefreshService from './components/RefreshService';

import ProfileRoutes from './routes/Profile';
import ArchivesRoutes from './routes/Archives';

import Loading from './views/Loading';
import Index from './views/Index';
import CharacterSelect from './views/CharacterSelect';
import Settings from './views/Settings';
import FAQ from './views/FAQ';
import Credits from './views/Credits';
import OOB from './views/OOB';

import Inspect from './views/Inspect';
import Read from './views/Read';
import Maps from './views/Maps';
import Legend from './views/Legend';
import ClanBannerBuilder from './views/ClanBannerBuilder';
import PGCR from './views/PGCR';
import Compare from './views/Compare';

import Test from './views/Test';
import TestThree from './views/TestThree';

const RedirectRoute = props => <Route {...props} render={({ location }) => <Redirect to={{ pathname: '/character-select', state: { from: location } }} />} />;

// Print timings of promises to console (and performance logger)
// if we're running in development mode.
async function timed(name, promise) {
  if (process.env.NODE_ENV === 'development') console.time(name);
  const result = await promise;
  if (process.env.NODE_ENV === 'development') console.timeEnd(name);
  return result;
}

class App extends React.Component {
  constructor(props) {
    super();
    this.state = {
      status: {
        code: false,
        detail: false
      }
    };

    this.currentLanguage = props.i18n.getCurrentLanguage();

    if (this.currentLanguage === 'debug') this.currentLanguage = 'en';

    // We do these as early as possible - we don't want to wait
    // for the component to mount before starting the web requests
    this.startupRequests = window.navigator.onLine && {
      storedManifest: timed('storedManifest', this.getStoredManifest()),
      manifestIndex: timed('GetDestinyManifest', bungie.GetDestinyManifest({ errors: { hide: true } })),
      bungieSettings: timed('GetCommonSettings', bungie.GetCommonSettings({ errors: { hide: true } })),
      voluspaStatistics: timed('statistics', voluspa.statistics())
    };

    const profile = ls.get('setting.profile');

    store.dispatch({
      type: 'MEMBER_SET_BY_PROFILE_ROUTE',
      payload: profile
    });

    let momentLocale = this.currentLanguage;
    if (this.currentLanguage === 'zh-chs') momentLocale = 'zh-cn';
    if (this.currentLanguage === 'zh-cht') momentLocale = 'zh-tw';

    moment.locale(momentLocale);

    if (['zh-cn', 'zh-tw'].indexOf(momentLocale) > -1) {
      moment.defineLocale('relative-sml', {
        parentLocale: momentLocale
      });
    } else {
      moment.defineLocale('relative-sml', {
        parentLocale: momentLocale,
        relativeTime: {
          future: 'in %s',
          past: '%s ago',
          s: 'now',
          ss: '%ss',
          m: '<1m',
          mm: '%dm',
          h: '1h',
          hh: '%dh',
          d: '1d',
          dd: '%dd',
          M: '1M',
          MM: '%dM',
          y: '1y',
          yy: '%dy'
        }
      });
    }
  }

  updateViewport = () => {
    let width = window.innerWidth;
    let height = window.innerHeight;
    store.dispatch({ type: 'VIEWPORT_CHANGED', payload: { width, height } });
  };

  async componentDidMount() {
    this.updateViewport();
    window.addEventListener('resize', this.updateViewport);

    if (!window.navigator.onLine) {
      this.setState({ status: { code: 'navigator_offline' } });
      return;
    }

    try {
      await timed('setUpManifest', this.setUpManifest());
    } catch (e) {
      console.log(e);

      if (e.message === 'Failed to fetch') {
        this.setState({ status: { code: 'error_fetchingManifest', detail: e } });
      } else if (e.message === 'maintenance') {
        this.setState({ status: { code: 'error_maintenance', detail: e } });
      } else {
        this.setState({ status: { code: 'error_setUpManifest', detail: e } });
      }
    }
  }

  async getStoredManifest() {
    const manifest = {};
    
    await dexie.table('manifest').each(row => {
      manifest[row.table] = row.definitions;
      manifest.version = row.version;
    });

    return manifest;
  }

  async setUpManifest() {
    this.setState({ status: { code: 'checkManifest' } });

    const storedManifest = await this.startupRequests.storedManifest;
    const manifestIndex = await this.startupRequests.manifestIndex;
    const bungieSettings = await this.startupRequests.bungieSettings;

    // in case for whatever reason we don't get anything back from the internet
    if (!manifestIndex || !bungieSettings) throw Error();

    if ((bungieSettings.ErrorCode === 1 && !bungieSettings.Response?.systems?.D2Profiles?.enabled) || bungieSettings.ErrorCode === 5 || manifestIndex.ErrorCode === 5) {
      throw new Error('maintenance');
    }

    const currentVersion = manifestIndex && manifestIndex.ErrorCode === 1 && manifestIndex.Response.jsonWorldContentPaths[this.currentLanguage];

    let tmpManifest = null;

    if (!storedManifest || currentVersion !== storedManifest.version) {
      // Manifest missing from IndexedDB or doesn't match the current version -
      // download a new one and store it.
      tmpManifest = await this.downloadNewManifest(currentVersion);
    } else {
      tmpManifest = storedManifest;
    }

    tmpManifest.settings = bungieSettings && bungieSettings.ErrorCode === 1 && bungieSettings.Response;

    this.availableLanguages = Object.keys(manifestIndex.Response.jsonWorldContentPaths);

    if (process.env.NODE_ENV === 'development') this.availableLanguages.unshift('debug');

    tmpManifest.statistics = (await this.startupRequests.voluspaStatistics) || {};

    manifest.set(tmpManifest, this.currentLanguage);

    this.setState({ status: { code: 'ready' } });
  }

  async downloadNewManifest(version) {
    this.setState({ status: { code: 'fetchManifest' } });

    const [manifest, DestinyHistoricalStatsDefinition] = await Promise.all([
      timed('downloadManifest', bungie.manifest(version)),
      timed('downloadManifestHistoricalStats', bungie.GetHistoricalStatsDefinition({ params: { locale: this.currentLanguage } }))      
    ]);

    if (DestinyHistoricalStatsDefinition.ErrorCode === 1 && DestinyHistoricalStatsDefinition.Response) {
      manifest.DestinyHistoricalStatsDefinition = DestinyHistoricalStatsDefinition.Response;
    } else {
      throw new Error('manifest');
    }

    this.setState({ status: { code: 'setManifest' } });

    try {
      await timed('clearTable', dexie.table('manifest').clear());
      await timed('storeManifest', dexie.table('manifest').bulkAdd(Object.keys(manifest).map(table => ({ table, definitions: manifest[table], version }))));
    } catch (error) {
      // Can't write a manifest if we're in private mode in safari
      console.warn(`Error while trying to store the manifest in indexeddb: ${error}`);
    }

    return manifest;
  }

  componentWillUnmount() {
    window.removeEventListener('resize', this.updateViewport);
  }

  render() {
    if (!window.ga) {
      GoogleAnalytics.init();
    }

    if (this.state.status.code !== 'ready') {
      // if (this.state.status.code !== 'ready' || this.state.status.code === 'ready') {
      return (
        <div className={cx('wrapper', this.props.theme.selected)}>
          <Loading state={this.state.status} />
          <NotificationLink />
        </div>
      );
    }

    return (
      <BrowserRouter>
        <Route
          render={route => (
            <div className={cx('wrapper', this.props.theme.selected, { standalone: window.matchMedia('(display-mode: standalone)').matches })}>
              <ServiceWorkerUpdate {...this.props} />
              <NotificationLink />
              <NotificationProgress />

              <Tooltip {...route} onRef={ref => (this.TooltipComponent = ref)} />
              <Route component={GoogleAnalytics.GoogleAnalytics} />
              <div className='main'>
                <Switch>
                  <Route path='/:membershipType([1|2|3|4|5])/:membershipId([0-9]+)/:characterId([0-9]+)?' render={route => <ProfileRoutes {...route} />} />
                  <Route path='/archives' component={ArchivesRoutes} />
                  <Route
                    render={() => (
                      <>
                        <Route render={route => <Header {...route} {...this.state} {...this.props} />} />
                        <Switch>
                          <RedirectRoute path='/clan' />
                          <RedirectRoute path='/character' exact />
                          <RedirectRoute path='/checklists' exact />
                          <RedirectRoute path='/collections/' />
                          <RedirectRoute path='/triumphs' />
                          <RedirectRoute path='/this-week' />
                          <RedirectRoute path='/reports' />
                          <RedirectRoute path='/now' />
                          <RedirectRoute path='/quests' />

                          <Route path='/character-select' exact component={CharacterSelect} />
                          <Route path='/pgcr/:instanceId?' exact render={route => <PGCR {...route} />} />
                          <Route path='/inspect/:hash?' exact component={Inspect} />
                          <Route path='/read/:kind?/:hash?' exact component={Read} />
                          <Route path='/compare/:object?' exact component={Compare} />
                          <Route path='/maps/:map?/:highlight?' render={route => <Maps {...route} />} />
                          <Route path='/legend' exact render={route => <Legend {...route} />} />
                          <Route path='/settings' exact render={route => <Settings {...route} availableLanguages={this.availableLanguages} />} />
                          <Route path='/faq' exact component={FAQ} />
                          <Route path='/credits' exact component={Credits} />
                          <Route path='/clan-banner-builder/:decalBackgroundColorId?/:decalColorId?/:decalId?/:gonfalonColorId?/:gonfalonDetailColorId?/:gonfalonDetailId?/:gonfalonId?/' exact component={ClanBannerBuilder} />
                          <Route path='/oob' component={OOB} />
                          <Route path='/test' component={Test} />
                          <Route path='/three' component={TestThree} />
                          <Route path='/' component={Index} />
                        </Switch>
                      </>
                    )}
                  />
                </Switch>
              </div>

              {/* Don't run the refresh service if we're currently selecting
                a character, as the refresh will cause the member to
                continually reload itself */}
              <Route path='/character-select' children={route => !route.match && <RefreshService {...route} />} />

              <Footer />
            </div>
          )}
        />
      </BrowserRouter>
    );
  }
}

function mapStateToProps(state, ownProps) {
  return {
    member: state.member,
    theme: state.theme
  };
}

export default compose(
  connect(mapStateToProps),
  withTranslation()
)(App);
