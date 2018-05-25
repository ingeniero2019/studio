import * as React from "react";
import { observable, action } from "mobx";
import { observer } from "mobx-react";
import * as classNames from "classnames";

import { formatDateTimeLong } from "shared/util";
import { VerticalHeaderWithBody, Header, Body } from "shared/ui/header-with-body";
import { Splitter } from "shared/ui/splitter";

import { findObjectByActivityLogEntry } from "shared/extensions/extensions";

import { appStore } from "instrument/window/app-store";

import { History, SearchResult } from "instrument/window/history";

import { Filters } from "instrument/window/terminal/filters";
import { SessionList } from "instrument/window/terminal/session-list";
import { Calendar } from "instrument/window/terminal/calendar";

@observer
export class SearchResultComponent extends React.Component<{
    history: History;
    searchResult: SearchResult;
}> {
    render() {
        const logEntry = this.props.searchResult.logEntry;
        const { date, type, message } = logEntry;

        let name;
        let content;

        const object = findObjectByActivityLogEntry(logEntry);
        if (object) {
            let info = object.activityLogEntryInfo(logEntry);
            if (info) {
                name = info.name;
                content = info.content;
            }
        }

        if (name === undefined) {
            name = `${type}: ${message.slice(0, 100)}`;
        }

        let className = classNames({
            selected: this.props.searchResult.selected
        });

        return (
            <tr
                className={className}
                onClick={() =>
                    this.props.history.search.selectSearchResult(this.props.searchResult)
                }
            >
                <td className="dateColumn">{formatDateTimeLong(date)}</td>
                <td className="contentColumn">{content}</td>
            </tr>
        );
    }
}

@observer
export class SearchResults extends React.Component<{ history: History }> {
    render() {
        let info;

        if (this.props.history.search.searchResults.length > 0) {
            info = `${this.props.history.search.searchResults.length} log items found`;
        } else if (!this.props.history.search.searchInProgress) {
            info = `No log item found.`;
        }

        return (
            <VerticalHeaderWithBody>
                <Header className="EezStudio_PanelHeader">{info}</Header>
                <Body className="EezStudio_HistoryTable selectable">
                    <table className="table">
                        <tbody>
                            {this.props.history.search.searchResults.map(searchResult => (
                                <SearchResultComponent
                                    key={searchResult.logEntry.id}
                                    history={this.props.history}
                                    searchResult={searchResult}
                                />
                            ))}
                        </tbody>
                    </table>
                </Body>
            </VerticalHeaderWithBody>
        );
    }
}

@observer
export class Search extends React.Component<{
    history: History;
}> {
    @observable searchText: string = "";

    @action.bound
    onSearchChange(event: any) {
        this.searchText = $(event.target).val() as string;
        this.props.history.search.search(this.searchText);
    }

    @action.bound
    toggleFilters(event: any) {
        event.preventDefault();
        event.stopPropagation();
        appStore.toggleFiltersVisible();
    }

    @action.bound
    viewCalendar(event: React.MouseEvent<HTMLElement>) {
        event.preventDefault();
        event.stopPropagation();
        appStore.setSearchViewSection("calendar");
    }

    @action.bound
    viewSessions(event: React.MouseEvent<HTMLElement>) {
        event.preventDefault();
        event.stopPropagation();
        appStore.setSearchViewSection("sessions");
    }

    render() {
        let inputClassName = classNames("EezStudio_SearchInput", {
            empty: !this.searchText
        });

        let input = (
            <input
                type="text"
                placeholder="&#xe8b6;"
                className={inputClassName}
                value={this.searchText}
                onChange={this.onSearchChange}
                onKeyDown={this.onSearchChange}
            />
        );

        let searchResultsVisible = this.props.history.search.searchActive;

        let calendarNavLinkClassName = classNames("nav-link", {
            active: appStore.searchViewSection === "calendar"
        });

        let sessionsNavLinkClassName = classNames("nav-link", {
            active: appStore.searchViewSection === "sessions"
        });

        const calendar = <Calendar history={this.props.history} />;

        let body;
        if (!this.props.history.isDeletedItemsHistory) {
            body = (
                <VerticalHeaderWithBody className="EezStudio_HistorySearch_Sections">
                    <Header>
                        {!this.props.history.isDeletedItemsHistory &&
                            appStore.filtersVisible && <Filters />}
                        <ul className="nav nav-tabs">
                            <li className="nav-item">
                                <a
                                    className={calendarNavLinkClassName}
                                    href="#"
                                    onClick={this.viewCalendar}
                                >
                                    Calendar
                                </a>
                            </li>
                            <li className="nav-item">
                                <a
                                    className={sessionsNavLinkClassName}
                                    href="#"
                                    onClick={this.viewSessions}
                                >
                                    Sessions List
                                </a>
                            </li>
                        </ul>
                    </Header>
                    <Body key="calendar" visible={appStore.searchViewSection === "calendar"}>
                        {calendar}
                    </Body>
                    <Body key="sessions" visible={appStore.searchViewSection === "sessions"}>
                        <SessionList history={this.props.history} />
                    </Body>
                </VerticalHeaderWithBody>
            );
        } else {
            body = calendar;
        }

        return (
            <VerticalHeaderWithBody className="EezStudio_HistorySearch">
                <Header>
                    {input}
                    {!this.props.history.isDeletedItemsHistory && (
                        <a href="#" onClick={this.toggleFilters}>
                            <i className="material-icons">
                                {appStore.filtersVisible
                                    ? "keyboard_arrow_up"
                                    : "keyboard_arrow_down"}
                            </i>{" "}
                            {appStore.filtersVisible ? "Hide Filters" : "Show Filters"}
                        </a>
                    )}
                </Header>
                <Body>
                    <Splitter
                        type="vertical"
                        sizes={searchResultsVisible ? "50%|50%" : "100$"}
                        persistId="instrument/window/history-search/splitter"
                    >
                        {searchResultsVisible && <SearchResults history={this.props.history} />}
                        {body}
                    </Splitter>
                </Body>
            </VerticalHeaderWithBody>
        );
    }
}
