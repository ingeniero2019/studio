import * as React from "react";
import { observable, computed, values, runInAction, action, toJS } from "mobx";
import { observer } from "mobx-react";
import { bind } from "bind-decorator";
import * as classNames from "classnames";

import { objectClone } from "shared/util";
import { _range } from "shared/algorithm";
import {
    IUnit,
    TIME_UNIT,
    TIME_UNIT_NO_CUSTOM_FORMAT,
    VOLTAGE_UNIT,
    CURRENT_UNIT
} from "shared/units";

import { validators } from "shared/model/validation";

import { VerticalHeaderWithBody, Header, Body, ToolbarHeader } from "shared/ui/header-with-body";
import { Splitter } from "shared/ui/splitter";
import {
    AxisController,
    ChartController,
    ChartMode,
    ChartsController,
    ChartsView,
    IAxisModel,
    LineController,
    ChartView,
    MouseHandler
} from "shared/ui/chart";
import { Toolbar } from "shared/ui/toolbar";
import { ButtonAction, DropdownButtonAction, DropdownItem } from "shared/ui/action";
import { showGenericDialog } from "shared/ui/generic-dialog";

import { AppStore } from "instrument/window/app-store";

import { BaseList, BaseListData, ListAxisModel } from "instrument/window/lists/store-renderer";
import {
    checkVoltage,
    getMaxVoltage,
    checkCurrent,
    getMaxCurrent,
    checkPower,
    getPowerLimitErrorMessage
} from "instrument/window/lists/store-renderer";
import {
    displayOption,
    ChartsDisplayOption,
    ChartsViewOptions
} from "instrument/window/lists/charts-view-options";

////////////////////////////////////////////////////////////////////////////////

const TABLE_LIST_DATA_DEFAULTS: any = {
    dwell: [],
    voltage: [],
    current: []
};

export function createEmptyTableListData() {
    return objectClone(TABLE_LIST_DATA_DEFAULTS);
}

export class TableListData extends BaseListData {
    @observable dwell: number[];
    @observable voltage: number[];
    @observable current: number[];

    constructor(list: BaseList, props: any) {
        super(list, props);

        this.dwell = props.dwell || TABLE_LIST_DATA_DEFAULTS.dwell;
        this.voltage = props.voltage || TABLE_LIST_DATA_DEFAULTS.voltage;
        this.current = props.current || TABLE_LIST_DATA_DEFAULTS.current;

        this.timeAxisModel = new TableListTimeAxisModel(list as TableList);
    }

    applyChanges(changes: any) {
        super.applyChanges(changes);

        if ("dwell" in changes) {
            this.dwell = changes.dwell;
        }

        if ("voltage" in changes) {
            this.voltage = changes.voltage;
        }

        if ("current" in changes) {
            this.current = changes.current;
        }
    }
}

export class TableList extends BaseList {
    @observable data: TableListData;

    constructor(props: any, appStore: AppStore) {
        super(props, appStore);
        this.type = "table";
        this.data = new TableListData(this, props.data);
    }

    @computed
    get numPoints() {
        return Math.max(this.data.dwell.length, this.data.current.length, this.data.voltage.length);
    }

    @computed
    get isMaxPointsReached() {
        return this.numPoints >= this.appStore.instrument!.listsMaxPointsProperty;
    }

    getMaxTime() {
        let max = 0;
        const dwellData = this.data.dwell;
        for (let i = 0; i < this.numPoints; ++i) {
            max += i < dwellData.length ? dwellData[i] : dwellData[dwellData.length - 1];
        }
        return max;
    }

    createChartsController(displayOption: ChartsDisplayOption, mode: ChartMode): ChartsController {
        return createTableChartsController(this, displayOption, mode);
    }

    renderDetailsView() {
        return <TableDetailsView list={this} />;
    }

    get tableListData() {
        return this.data;
    }
}

////////////////////////////////////////////////////////////////////////////////

type CellKey = "dwell" | "voltage" | "current";

////////////////////////////////////////////////////////////////////////////////

const selectedCell = observable<{
    index: number;
    key: CellKey;
}>({
    index: 0,
    key: "dwell"
});

////////////////////////////////////////////////////////////////////////////////

class TableListTimeAxisModel extends ListAxisModel {
    constructor(public list: TableList) {
        super(list, TIME_UNIT);
    }

    get minValue() {
        return 0;
    }

    @computed
    get maxValue() {
        return this.list.getMaxTime();
    }
}

////////////////////////////////////////////////////////////////////////////////

export class TableLineController extends LineController {
    constructor(public id: string, public yAxisController: AxisController) {
        super(id, yAxisController);
    }

    get list() {
        return (this.yAxisController.chartsController as TableChartsController).list;
    }

    @computed
    get tableData() {
        return this.list.tableListData;
    }

    @computed
    get dwells(): number[] {
        return this.tableData.dwell;
    }

    @computed
    get values(): number[] {
        return this.tableData[this.yAxisController.unit.name as "voltage" | "current"];
    }

    @computed
    get size(): number {
        return this.list.numPoints;
    }

    @computed
    get yMin(): number {
        //return Math.min(...this.values);
        return this.yAxisController.axisModel.minValue;
    }

    @computed
    get yMax(): number {
        //return Math.max(...this.values);
        return this.yAxisController.axisModel.maxValue;
    }

    render(clipId: string) {
        return <TableLineView key={this.id} tableLineController={this} clipId={clipId} />;
    }
}

////////////////////////////////////////////////////////////////////////////////

@observer
export class TableLineView extends React.Component<
    {
        tableLineController: TableLineController;
        clipId: string;
    },
    {}
> {
    render() {
        const tableLineController = this.props.tableLineController;
        const { dwells, values, size } = tableLineController;
        const yAxisController = tableLineController.yAxisController;
        const chartsController = yAxisController.chartsController;
        const xAxisController = chartsController.xAxisController;
        const { chartLeft, chartBottom } = chartsController;

        let path;

        for (let i = 0; i < size; ++i) {
            if (i === 0) {
                path = `M${chartLeft + xAxisController.valueToPx(0)} ${chartBottom -
                    yAxisController.valueToPx(values[0] || 0)}`;
            } else {
                if (i < values.length) {
                    path += " v " + -(values[i] - (values[i - 1] || 0)) * yAxisController.scale;
                }
            }
            path +=
                " h " +
                (i < dwells.length ? dwells[i] : dwells[dwells.length - 1] || 1) *
                    xAxisController.scale;
        }

        return (
            <path
                className="EezStudio_ListChartView_Sampling"
                d={path}
                style={{ pointerEvents: "none" }}
                stroke={yAxisController.axisModel.color}
                clipPath={`url(#${this.props.clipId})`}
            />
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

function executeCommand(list: TableList, modificator: (data: TableListData) => void) {
    let oldData = toJS(list.data);
    let newData = toJS(list.data);

    runInAction(() => {
        modificator(newData);
    });

    list.appStore.undoManager.addCommand(
        "Edit table list",
        list.appStore.instrumentListStore,
        list,
        {
            execute: action(() => {
                list.data.applyChanges(newData);
            }),
            undo: action(() => {
                list.data.applyChanges(oldData);
            })
        }
    );
}

function cellKeyFromUnit(unit: IUnit): CellKey {
    if (unit === TIME_UNIT) {
        return "dwell";
    }
    return unit.name as "voltage" | "current";
}

////////////////////////////////////////////////////////////////////////////////

@observer
class TableChartsHeader extends React.Component<{ chartsController: ChartsController }, {}> {
    get list() {
        return (this.props.chartsController as TableChartsController).list;
    }

    @bind
    editProperties() {
        showGenericDialog({
            dialogDefinition: {
                fields: [
                    {
                        name: "name",
                        type: "string",
                        validators: [
                            validators.required,
                            validators.unique(this.list, values(this.list.appStore.instrumentLists))
                        ]
                    },
                    {
                        name: "description",
                        type: "string"
                    }
                ]
            },

            values: {
                name: this.list.name,
                description: this.list.description
            }
        })
            .then(result => {
                const list = this.list;

                const oldName = list.name;
                const oldDescription = list.description;

                const newName = result.values.name;
                const newDescription = result.values.description;

                if (oldName !== newName || oldDescription !== newDescription) {
                    list.appStore.undoManager.addCommand(
                        "Edit envelope list",
                        this.list.appStore.instrumentListStore,
                        list,
                        {
                            execute: action(() => {
                                list.name = newName;
                                list.description = newDescription;
                            }),
                            undo: action(() => {
                                list.name = oldName;
                                list.description = oldDescription;
                            })
                        }
                    );
                }
            })
            .catch(() => {});
    }

    render() {
        return (
            <Header className="EezStudio_ListChartView_Header">
                <Toolbar>
                    <ButtonAction
                        text="Edit Properties"
                        className="btn-secondary"
                        title="Edit properties"
                        onClick={this.editProperties}
                    />
                    <ChartsViewOptions chartsController={this.props.chartsController} />
                </Toolbar>
            </Header>
        );
    }
}

interface CellProps {
    index: number;
    unit: IUnit;
    value: number | undefined;
    onChange: (index: number, unit: IUnit, value: string) => void;
    onFocus: () => void;
    setError(error: string | undefined): void;
}

@observer
class Cell extends React.Component<CellProps, {}> {
    @observable value: string = Cell.getValue(this.props);

    static getValue(props: CellProps): string {
        if (props.value === undefined) {
            return "";
        }
        return props.unit.formatValue(props.value);
    }

    @action
    componentWillReceiveProps(props: CellProps) {
        this.value = Cell.getValue(props);
    }

    @bind
    onBlur(e: React.FocusEvent<HTMLElement>) {
        this.props.onChange(this.props.index, this.props.unit, (e.target as HTMLElement).innerText);
    }

    static focusNext(element: HTMLElement, offset: number) {
        element.blur();
        setTimeout(() => {
            let cells = $(element)
                .parents("tbody")
                .find("td");

            let nextCellIndex = cells.index(element) + offset;

            if (nextCellIndex < 0) {
                nextCellIndex += cells.length;
            } else if (nextCellIndex >= cells.length) {
                nextCellIndex -= cells.length;
            }

            if (!cells.eq(nextCellIndex).attr("contenteditable")) {
                nextCellIndex += offset;

                if (nextCellIndex < 0) {
                    nextCellIndex += cells.length;
                } else if (nextCellIndex >= cells.length) {
                    nextCellIndex -= cells.length;
                }
            }

            cells[nextCellIndex].focus();
        }, 0);
    }

    static getCaretPosition(editableDiv: Element) {
        var caretPos = 0,
            sel,
            range;
        sel = window.getSelection();
        if (sel.rangeCount) {
            range = sel.getRangeAt(0);
            if (range.commonAncestorContainer.parentNode === editableDiv) {
                caretPos = range.endOffset;
            }
        }
        return caretPos;
    }

    @bind
    onKeyDown(e: React.KeyboardEvent<HTMLElement>) {
        if (e.key === "Enter") {
            e.preventDefault();
            e.stopPropagation();
            Cell.focusNext(e.target as HTMLElement, 1);
        } else if (e.key === "Escape") {
            e.currentTarget.innerText = Cell.getValue(this.props);
            this.props.setError(undefined);
        } else if (!e.shiftKey && !e.ctrlKey) {
            if (e.key === "ArrowUp") {
                e.preventDefault();
                e.stopPropagation();
                Cell.focusNext(e.target as HTMLElement, -4);
            } else if (e.key === "ArrowDown") {
                e.preventDefault();
                e.stopPropagation();
                Cell.focusNext(e.target as HTMLElement, 4);
            } else if (e.key === "ArrowLeft") {
                if (e.altKey || e.metaKey || Cell.getCaretPosition(e.target as Element) === 0) {
                    e.preventDefault();
                    e.stopPropagation();
                    Cell.focusNext(e.target as HTMLElement, -1);
                }
            } else if (e.key === "ArrowRight") {
                if (
                    e.altKey ||
                    e.metaKey ||
                    Cell.getCaretPosition(e.target as Element) ===
                        (e.target as HTMLElement).innerText.length
                ) {
                    e.preventDefault();
                    e.stopPropagation();
                    Cell.focusNext(e.target as HTMLElement, 1);
                }
            }
        }
    }

    render() {
        const { index, unit, onFocus } = this.props;
        const className = classNames(
            "EezStudio_TableListEditor_Cell",
            `EezStudio_TableListEditor_Cell_${index}_${cellKeyFromUnit(unit)}`,
            {
                selected: index === selectedCell.index && cellKeyFromUnit(unit) === selectedCell.key
            }
        );
        return (
            <td
                className={className}
                contentEditable
                suppressContentEditableWarning
                onFocus={onFocus}
                onBlur={this.onBlur}
                onKeyDown={this.onKeyDown}
            >
                {this.value}
            </td>
        );
    }
}

@observer
export class Table extends React.Component<
    {
        list: TableList;
        className: string;
        onCellFocus: (index: number, key: CellKey) => void;
        setError(error: string | undefined): void;
    },
    {}
> {
    @observable error: string | undefined;

    @computed
    get data() {
        return this.props.list.data;
    }

    @computed
    get numRows() {
        return this.props.list.isMaxPointsReached
            ? this.props.list.numPoints
            : this.props.list.numPoints + 1;
    }

    getValue(index: number, key: CellKey) {
        const array = this.data[key];
        if (array && index < array.length) {
            return array[index];
        }
        return undefined;
    }

    @action.bound
    onValueChange(index: number, unit: IUnit, value: string) {
        let key = cellKeyFromUnit(unit);
        let array = this.data[key];
        let currentValue = array && index < array.length ? array[index] : undefined;
        let numValue = unit.parseValue(value);
        if (numValue != currentValue) {
            if (typeof numValue !== "number") {
                $(`.EezStudio_TableListEditor_Cell_${index}_${key}`).focus();
                this.props.setError("Invalid value");
                return;
            }

            if (key === "voltage" || key === "current") {
                let power;
                if (key === "voltage") {
                    if (!checkVoltage(numValue, this.props.list.appStore)) {
                        $(`.EezStudio_TableListEditor_Cell_${index}_${key}`).focus();
                        this.props.setError(
                            `Allowed range: 0 - ${unit.formatValue(
                                getMaxVoltage(this.props.list.appStore)
                            )}`
                        );
                        return;
                    }
                    power = numValue * this.props.list.data.current[index];
                } else {
                    if (!checkCurrent(numValue, this.props.list.appStore)) {
                        $(`.EezStudio_TableListEditor_Cell_${index}_${key}`).focus();
                        this.props.setError(
                            `Allowed range: 0 - ${unit.formatValue(
                                getMaxCurrent(this.props.list.appStore)
                            )}`
                        );
                        return;
                    }
                    power = numValue * this.props.list.data.voltage[index];
                }

                if (!checkPower(power, this.props.list.appStore)) {
                    $(`.EezStudio_TableListEditor_Cell_${index}_${key}`).focus();
                    this.props.setError(getPowerLimitErrorMessage(this.props.list.appStore));
                    return;
                }
            } else {
                const minDwell = this.props.list.appStore.instrument!.listsMinDwellProperty;
                const maxDwell = this.props.list.appStore.instrument!.listsMaxDwellProperty;
                if (numValue < minDwell || numValue > maxDwell) {
                    $(`.EezStudio_TableListEditor_Cell_${index}_${key}`).focus();
                    this.props.setError(
                        `Allowed range: ${TIME_UNIT_NO_CUSTOM_FORMAT.formatValue(
                            minDwell,
                            this.props.list.appStore.instrument!.getDigits(TIME_UNIT)
                        )} - ${TIME_UNIT_NO_CUSTOM_FORMAT.formatValue(
                            maxDwell,
                            this.props.list.appStore.instrument!.getDigits(TIME_UNIT)
                        )}`
                    );
                    return;
                }
            }

            executeCommand(this.props.list, data => {
                let array: any = data[key];
                if (!array) {
                    array = [];
                    data[key] = array;
                }

                for (let i = index - 1; i >= 0 && isNaN(array[i]); --i) {
                    array[i] = numValue;
                }

                array[index] = numValue;

                while (
                    array.length > 0 &&
                    !array[array.length - 1] &&
                    array[array.length - 1] !== 0
                ) {
                    array.splice(array.length - 1, 1);
                }
            });
        }

        this.props.setError(undefined);
        return true;
    }

    render() {
        return (
            <table className={this.props.className}>
                <thead>
                    <tr>
                        <th />
                        <th>Dwell</th>
                        <th>Voltage</th>
                        <th>Current</th>
                    </tr>
                </thead>
                <tbody>
                    {_range(this.numRows).map(index => (
                        <tr key={index}>
                            <td>{index + 1}</td>
                            <Cell
                                index={index}
                                unit={TIME_UNIT}
                                value={this.getValue(index, "dwell")}
                                onChange={this.onValueChange}
                                onFocus={() => this.props.onCellFocus(index, "dwell")}
                                setError={this.props.setError}
                            />
                            <Cell
                                index={index}
                                unit={VOLTAGE_UNIT}
                                value={this.getValue(index, "voltage")}
                                onChange={this.onValueChange}
                                onFocus={() => this.props.onCellFocus(index, "voltage")}
                                setError={this.props.setError}
                            />
                            <Cell
                                index={index}
                                unit={CURRENT_UNIT}
                                value={this.getValue(index, "current")}
                                onChange={this.onValueChange}
                                onFocus={() => this.props.onCellFocus(index, "current")}
                                setError={this.props.setError}
                            />
                        </tr>
                    ))}
                </tbody>
            </table>
        );
    }
}

interface TableDetailsViewProps {
    list: TableList;
}

@observer
export class TableDetailsView extends React.Component<TableDetailsViewProps, {}> {
    @observable list: TableList = this.props.list;

    @computed
    get chartsController() {
        return createTableChartsController(
            this.list,
            displayOption.get() as ChartsDisplayOption,
            "editable"
        );
    }

    @action
    componentWillReceiveProps(nextProps: TableDetailsViewProps) {
        this.list = nextProps.list;
    }

    @action.bound
    onCellFocus(index: number, key: CellKey) {
        selectedCell.index = index;
        selectedCell.key = key;
    }

    get isLastRow() {
        return selectedCell.index === this.props.list.numPoints;
    }

    get canInsertRowAbove() {
        return !this.list.isMaxPointsReached && !this.isLastRow;
    }

    @bind
    insertRowAbove() {
        if (this.canInsertRowAbove) {
            const index = selectedCell.index;
            const key = selectedCell.key;

            executeCommand(this.props.list, data => {
                data.dwell.splice(index, 0, data.dwell[index]);
                data.voltage.splice(index, 0, data.voltage[index]);
                data.current.splice(index, 0, data.current[index]);
            });

            setTimeout(() => {
                $(`.EezStudio_TableListEditor_Cell_${index}_${key}`).focus();
            }, 10);
        }
    }

    get canInsertRowBelow() {
        return !this.list.isMaxPointsReached && !this.isLastRow;
    }

    @bind
    insertRowBelow() {
        if (this.canInsertRowBelow) {
            const index = selectedCell.index;
            const key = selectedCell.key;

            executeCommand(this.props.list, data => {
                data.dwell.splice(index + 1, 0, data.dwell[index]);
                data.voltage.splice(index + 1, 0, data.voltage[index]);
                data.current.splice(index + 1, 0, data.current[index]);
            });

            setTimeout(() => {
                $(`.EezStudio_TableListEditor_Cell_${index + 1}_${key}`).focus();
            }, 10);
        }
    }

    get canDeleteRow() {
        return !this.isLastRow;
    }

    @bind
    deleteRow() {
        if (this.canDeleteRow) {
            const index = selectedCell.index;
            const key = selectedCell.key;

            executeCommand(this.props.list, data => {
                data.dwell.splice(index, 1);
                data.voltage.splice(index, 1);
                data.current.splice(index, 1);
            });

            setTimeout(() => {
                $(`.EezStudio_TableListEditor_Cell_${index}_${key}`).focus();
            }, 10);
        }
    }

    get canClearColumn() {
        return selectedCell.index < this.props.list.data[selectedCell.key].length;
    }

    @bind
    clearColumn() {
        if (this.canClearColumn) {
            const index = selectedCell.index;
            const key = selectedCell.key;

            executeCommand(this.props.list, data => {
                data[key].splice(index, data[key].length - index);
            });

            setTimeout(() => {
                $(`.EezStudio_TableListEditor_Cell_${index}_${key}`).focus();
            }, 10);
        }
    }

    get canDeleteAllFromCursor() {
        return !this.isLastRow;
    }

    @bind
    deleteAllFromCursor() {
        if (this.canDeleteAllFromCursor) {
            const index = selectedCell.index;
            const key = selectedCell.key;

            executeCommand(this.props.list, data => {
                data.dwell.splice(index, data.dwell.length - index);
                data.voltage.splice(index, data.voltage.length - index);
                data.current.splice(index, data.current.length - index);
            });

            setTimeout(() => {
                $(`.EezStudio_TableListEditor_Cell_${index}_${key}`).focus();
            }, 10);
        }
    }

    get canDeleteAll() {
        return this.props.list.numPoints > 0;
    }

    @bind
    deleteAll() {
        if (this.canDeleteAll) {
            const key = selectedCell.key;

            executeCommand(this.props.list, data => {
                data.dwell = [];
                data.voltage = [];
                data.current = [];
            });

            setTimeout(() => {
                $(`.EezStudio_TableListEditor_Cell_0_${key}`).focus();
            }, 10);
        }
    }

    @observable error: string | undefined;

    @action.bound
    setError(error: string | undefined) {
        this.error = error;
    }

    render() {
        const { list } = this.props;

        return (
            <Splitter
                type="vertical"
                sizes="66%|34%"
                persistId="instrument/lists/table"
                className="EezStudio_TableListEditor_Details"
            >
                <VerticalHeaderWithBody>
                    <TableChartsHeader chartsController={this.chartsController} />
                    <Body>
                        <ChartsView chartsController={this.chartsController} tabIndex={0} />
                    </Body>
                </VerticalHeaderWithBody>

                <VerticalHeaderWithBody>
                    <ToolbarHeader className="EezStudio_TableListEditor_Toolbar">
                        <DropdownButtonAction
                            text="Insert"
                            title="Insert rows"
                            className="btn btn-secondary"
                        >
                            <DropdownItem
                                text="Insert row above"
                                onClick={this.insertRowAbove}
                                disabled={!this.canInsertRowAbove}
                            />
                            <DropdownItem
                                text="Insert row below"
                                onClick={this.insertRowBelow}
                                disabled={!this.canInsertRowBelow}
                            />
                        </DropdownButtonAction>
                        <DropdownButtonAction
                            text="Delete"
                            title="Delete cells"
                            className="btn btn-secondary"
                        >
                            <DropdownItem
                                text="Delete row"
                                onClick={this.deleteRow}
                                disabled={!this.canDeleteRow}
                            />
                            <DropdownItem
                                text="Clear column from cursor down"
                                onClick={this.clearColumn}
                                disabled={!this.canClearColumn}
                            />
                            <DropdownItem
                                text="Delete all from cursor down"
                                onClick={this.deleteAllFromCursor}
                                disabled={!this.canDeleteAllFromCursor}
                            />
                            <DropdownItem text="Delete all" onClick={this.deleteAll} />
                        </DropdownButtonAction>
                        {this.list.isMaxPointsReached && (
                            <div className="text-success">Max no. of points reached.</div>
                        )}
                        {<div className="text-danger">{this.error}</div>}
                    </ToolbarHeader>
                    <Body className="EezStudio_TableListEditor_TableContainer">
                        <Table
                            className="EezStudio_TableListEditor_Table"
                            list={list}
                            onCellFocus={this.onCellFocus}
                            setError={this.setError}
                        />
                    </Body>
                </VerticalHeaderWithBody>
            </Splitter>
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

class TableChartsController extends ChartsController {
    constructor(public list: TableList, mode: ChartMode, xAxisModel: IAxisModel) {
        super(mode, xAxisModel, list.data.viewOptions);
    }
}

////////////////////////////////////////////////////////////////////////////////

class TableChartController extends ChartController {
    constructor(chartsController: TableChartsController, displayOption: ChartsDisplayOption) {
        super(chartsController, displayOption);
    }

    onDragStart(chartView: ChartView, event: PointerEvent): MouseHandler | undefined {
        let point = this.chartView!.transformEventPoint(event);
        const pointTime = this.xAxisController.pxToValue(point.x);

        const list = (this.chartsController as TableChartsController).list;
        const data = list.data;
        if (data.dwell.length === 0) {
            return;
        }
        let time = 0;
        let lastDwell: number | undefined = data.dwell[0];
        for (let i = 0; i < list.numPoints; ++i) {
            let dwell: number | undefined = data.dwell[i];
            if (isNaN(dwell)) {
                dwell = lastDwell;
            }
            if (dwell === undefined) {
                return;
            }
            lastDwell = dwell;
            if (pointTime >= time && pointTime < time + lastDwell) {
                runInAction(() => {
                    selectedCell.index = i;
                });
                setTimeout(() => {
                    $(`.EezStudio_TableListEditor_Cell_${i}_${selectedCell.key}`).focus();
                }, 10);
                return;
            }
            time += lastDwell;
        }

        return undefined;
    }

    customRender() {
        const data = (this.chartsController as TableChartsController).list.data;
        if (data.dwell.length === 0) {
            return null;
        }
        let time = 0;
        let lastDwell: number | undefined = data.dwell[0];
        for (let i = 0; i <= selectedCell.index; ++i) {
            let dwell: number;
            if (i < data.dwell.length) {
                dwell = data.dwell[i];
            } else {
                dwell = lastDwell;
            }
            if (isNaN(dwell)) {
                dwell = lastDwell;
            }
            if (dwell === undefined) {
                return null;
            }
            time += dwell;
            lastDwell = dwell;
        }
        if (lastDwell === undefined) {
            return null;
        }

        let x =
            this.chartsController.chartLeft +
            Math.max(this.xAxisController.valueToPx(time - lastDwell), 0);
        let width = Math.max(this.xAxisController.valueToPx(lastDwell), 0);

        let y = this.chartsController.chartTop;
        let height = this.chartsController.chartHeight;

        return (
            <rect
                className="EezStudio_TableListEditor_SelectedCellRect"
                x={x}
                y={y}
                width={width}
                height={height}
            />
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

export function createTableChartsController(
    list: TableList,
    displayOption: ChartsDisplayOption,
    mode: ChartMode
) {
    const chartsController = new TableChartsController(list, mode, list.data.timeAxisModel);

    const charts: ChartController[] = [];

    if (displayOption === "both") {
        const chartController = new TableChartController(chartsController, displayOption);

        chartController.createYAxisController(VOLTAGE_UNIT, list.data.voltageAxisModel);
        chartController.createYAxisControllerOnRightSide(CURRENT_UNIT, list.data.currentAxisModel);

        chartController.lineControllers.push(
            new TableLineController(
                "envelope-sample-data-" + chartController.yAxisController.position,
                chartController.yAxisController
            )
        );
        chartController.lineControllers.push(
            new TableLineController(
                "envelope-sample-data-" + chartController.yAxisControllerOnRightSide!.position,
                chartController.yAxisControllerOnRightSide!
            )
        );

        charts.push(chartController);
    } else {
        if (displayOption === "voltage" || displayOption === "split") {
            const chartController = new TableChartController(chartsController, "voltage");
            chartController.createYAxisController(VOLTAGE_UNIT, list.data.voltageAxisModel);
            chartController.lineControllers.push(
                new TableLineController(
                    "envelope-sample-data-" + chartController.yAxisController.position,
                    chartController.yAxisController
                )
            );
            charts.push(chartController);
        }

        if (displayOption === "current" || displayOption === "split") {
            const chartController = new TableChartController(chartsController, "current");
            chartController.createYAxisController(CURRENT_UNIT, list.data.currentAxisModel);
            chartController.lineControllers.push(
                new TableLineController(
                    "envelope-sample-data-" + chartController.yAxisController.position,
                    chartController.yAxisController
                )
            );
            charts.push(chartController);
        }
    }

    chartsController.chartControllers = charts;

    return chartsController;
}
