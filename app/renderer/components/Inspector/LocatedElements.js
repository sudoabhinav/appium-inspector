import React, { Component } from 'react';
import { clipboard } from '../../polyfills';
import { Input, Row, Col, Button } from 'antd';
import InspectorStyles from './Inspector.css';
import { withTranslation } from '../../util';

class LocatedElements extends Component {

  onSubmit () {
    const {locatedElements, locatorTestStrategy, locatorTestValue, searchForElement, clearSearchResults, hideLocatorTestModal} = this.props;
    if (locatedElements) {
      hideLocatorTestModal();
      clearSearchResults();
    } else {
      searchForElement(locatorTestStrategy, locatorTestValue);
    }
  }

  onCancel () {
    const {hideLocatorTestModal, clearSearchResults} = this.props;
    hideLocatorTestModal();
    clearSearchResults();
  }

  render () {
    const {
      locatedElements,
      applyClientMethod,
      setLocatorTestElement,
      locatorTestElement,
      clearSearchResults,
      t,
    } = this.props;

    return <Row>
      <p className={InspectorStyles['back-link-container']}>
        <a onClick={(e) => e.preventDefault() || clearSearchResults()}>{t('back')}</a>
      </p>
      {t('elementsCount', {elementCount: locatedElements.length})}
      <Col>
        <select className={InspectorStyles['locator-search-results']}
          multiple='true'
          onChange={(e) => setLocatorTestElement(e.target.value)}
          value={[locatorTestElement]}>
          {locatedElements.map((elementId) => (
            <option key={elementId} value={elementId}>{elementId}</option>
          ))}
          {locatedElements.length === 0 && <option disabled>{t('couldNotFindAnyElements')}</option>}
        </select>
        {locatedElements.length > 0 && <div className={InspectorStyles['locator-test-interactions-container']}>
          <div>
            <Button size='small'
              disabled={!locatorTestElement}
              onClick={() => clipboard.writeText(locatorTestElement)}
            >
              {t('Copy ID')}
            </Button>
          </div>
        </div>}
      </Col>
    </Row>;
  }
}

export default withTranslation(LocatedElements);
