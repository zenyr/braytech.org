import React from 'react';
import { Link } from 'react-router-dom';
import { withTranslation } from 'react-i18next';
import Moment from 'react-moment';

import manifest from '../../../utils/manifest';
import packageJSON from '../../../../package.json';
import { ReactComponent as Patreon } from '../../PatreonDevice.svg';
import { ReactComponent as PayPal } from '../../PayPalDevice.svg';

import './styles.css';

class Footer extends React.Component {
  render() {
    const { t, linkOnClick, minimal } = this.props;

    return (
      <div id='footer'>
        <div className='wrapper'>
          <div>
            <div>© 2020 <a className='hyperlink' href='https://thomchap.com.au' target='_blank' rel='noopener noreferrer'>Tom Chapman</a></div>
            <div>{t('Version')} <span>{packageJSON.version}</span></div>
            {manifest.statistics.general ? <div>{t('VOLUSPA last indexed')} <Moment fromNow>{manifest.statistics.general.status.lastScraped}</Moment></div> : null}
          </div>
          <ul>
            {!minimal ? (
              <>
                <li>
                  <Link className='hyperlink' to='/faq' onClick={linkOnClick}>
                    {t('FAQ')}
                  </Link>
                </li>
                <li>
                  <Link className='hyperlink' to='/credits' onClick={linkOnClick}>
                    {t('Credits')}
                  </Link>
                </li>
              </>
            ) : null}
            <li>
              <a className='hyperlink' href='https://twitter.com/justrealmilk' target='_blank' rel='noopener noreferrer'>
                Twitter
              </a>
            </li>
            <li>
              <a className='hyperlink' href='https://discordapp.com/invite/8jESWWX' target='_blank' rel='noopener noreferrer'>
                Discord
              </a>
            </li>
            <li>
              <a className='hyperlink' href='https://paypal.me/braytechltd' target='_blank' rel='noopener noreferrer'>
                PayPal <PayPal />
              </a>
            </li>
            <li>
              <a className='hyperlink' href='https://www.patreon.com/braytech' target='_blank' rel='noopener noreferrer'>
                Patreon <Patreon />
              </a>
            </li>
          </ul>
        </div>
      </div>
    );
  }
}

export default withTranslation()(Footer);
