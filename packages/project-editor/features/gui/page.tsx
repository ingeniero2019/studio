import React from "react";
import { observable, computed, runInAction, action } from "mobx";
import { observer } from "mobx-react";
import { bind } from "bind-decorator";

import { _find } from "eez-studio-shared/algorithm";
import { to16bitsColor } from "eez-studio-shared/color";
import { Rect } from "eez-studio-shared/geometry";

import { Splitter } from "eez-studio-ui/splitter";

import {
    EezObject,
    ClassInfo,
    PropertyInfo,
    registerClass,
    EezArrayObject,
    PropertyType,
    isSubclassOf,
    IEditorState,
    generalGroup,
    geometryGroup,
    styleGroup,
    specificGroup,
    EditorComponent,
    NavigationComponent,
    asArray
} from "project-editor/core/object";
import {
    TreeObjectAdapter,
    ITreeObjectAdapter,
    TreeAdapter
} from "project-editor/core/objectAdapter";
import { loadObject } from "project-editor/core/serialization";
import { ProjectStore, NavigationStore, EditorsStore, IPanel } from "project-editor/core/store";
import * as output from "project-editor/core/output";

import { ListNavigation } from "project-editor/components/ListNavigation";
import { Tree } from "project-editor/components/Tree";
import { Panel } from "project-editor/components/Panel";

import { DataContext } from "project-editor/features/data/data";
import {
    IResizeHandler,
    IDesignerContext
} from "project-editor/features/gui/page-editor/designer-interfaces";
import { PageEditor as StudioPageEditor } from "project-editor/features/gui/page-editor/editor";
import { WidgetPalette } from "project-editor/features/gui/page-editor/WidgetPalette";
import { WidgetContainerComponent } from "project-editor/features/gui/page-editor/render";

import { Editors, PropertiesPanel } from "project-editor/project/ProjectEditor";

import { Widget } from "project-editor/features/gui/widget";

import { findStyle } from "project-editor/features/gui/gui";
import { getThemedColor, ThemesSideView } from "project-editor/features/gui/theme";

////////////////////////////////////////////////////////////////////////////////

@observer
export class PageEditor extends EditorComponent implements IPanel {
    @bind
    focusHandler() {
        NavigationStore.setSelectedPanel(this);
    }

    @computed
    get treeAdapter() {
        let pageTabState = this.props.editor.state as PageTabState;
        return new TreeAdapter(pageTabState.widgetContainerDisplayItem, undefined, undefined, true);
    }

    @computed
    get selectedObject() {
        let pageTabState = this.props.editor.state as PageTabState;
        return pageTabState.selectedObject;
    }

    @computed
    get selectedObjects() {
        let pageTabState = this.props.editor.state as PageTabState;
        return pageTabState.selectedObjects;
    }

    cutSelection() {
        this.treeAdapter.cutSelection();
    }

    copySelection() {
        this.treeAdapter.copySelection();
    }

    pasteSelection() {
        this.treeAdapter.pasteSelection();
    }

    deleteSelection() {
        this.treeAdapter.deleteSelection();
    }

    render() {
        let pageTabState = this.props.editor.state as PageTabState;
        return <StudioPageEditor widgetContainer={pageTabState.widgetContainerDisplayItem} />;
    }
}

////////////////////////////////////////////////////////////////////////////////

export class PageTabState implements IEditorState {
    page: Page;
    widgetContainerDisplayItem: ITreeObjectAdapter;

    constructor(object: EezObject) {
        this.page = object as Page;
        this.widgetContainerDisplayItem = new TreeObjectAdapter(this.page);
    }

    @computed
    get selectedObject(): EezObject | undefined {
        return this.widgetContainerDisplayItem.selectedObject || this.page;
    }

    @computed
    get selectedObjects() {
        return this.widgetContainerDisplayItem.selectedObjects;
    }

    loadState(state: any) {
        this.widgetContainerDisplayItem.loadState(state);
    }

    saveState() {
        return this.widgetContainerDisplayItem.saveState();
    }

    @action
    selectObject(object: EezObject) {
        let ancestor: EezObject | undefined;
        for (ancestor = object; ancestor; ancestor = ancestor._parent) {
            let item = this.widgetContainerDisplayItem.getObjectAdapter(ancestor);
            if (item) {
                this.widgetContainerDisplayItem.selectItems([item]);
                return;
            }
        }
    }
}

////////////////////////////////////////////////////////////////////////////////

// We will not load all widgets for all pages at once, since it could take several seconds
// for large project, and during that time application will be blocked. Therefore, we are
// lazy loading, one page at a time.

export const lazyLoadPageWidgets = (function() {
    const pageWidgets = new Map<Page, any>();
    const priority: Page[] = [];

    function setPageWidgets(page: Page, widgets: any) {
        pageWidgets.set(page, widgets);

        if (pageWidgets.size == 1) {
            setTimeout(loadNextPage, 1000);
        }
    }

    function loadPageWidgets(page: Page) {
        const widgets = pageWidgets.get(page);
        if (widgets) {
            pageWidgets.delete(page);
            runInAction(
                () =>
                    (page.widgets = loadObject(page, widgets, Widget, "widgets") as EezArrayObject<
                        Widget
                    >)
            );
        }
    }

    function loadNextPage() {
        if (pageWidgets.size > 0) {
            let page = priority.shift();
            if (!page) {
                page = pageWidgets.keys().next().value;
            }

            if (page) {
                loadPageWidgets(page);
            }

            if (pageWidgets.size > 0) {
                setTimeout(loadNextPage);
                return;
            }
        }

        runInAction(() => (ProjectStore.project._allGuiPagesLoaded = true));
    }

    return {
        setPageWidgets,

        // this method is exported, so app can load some page widgets in advance if required
        prioritizePage(page: Page) {
            if (pageWidgets.has(page)) {
                priority.push(page);
            }
        }
    };
})();

////////////////////////////////////////////////////////////////////////////////

@observer
export class PagesNavigation extends NavigationComponent {
    @computed
    get object() {
        if (NavigationStore.selectedPanel) {
            return NavigationStore.selectedPanel.selectedObject;
        }
        return NavigationStore.selectedObject;
    }

    @computed
    get widgetContainerDisplayItem() {
        if (!EditorsStore.activeEditor) {
            return undefined;
        }
        let pageTabState = EditorsStore.activeEditor.state as PageTabState;
        return pageTabState.widgetContainerDisplayItem;
    }

    @computed
    get treeAdapter() {
        if (!this.widgetContainerDisplayItem) {
            return null;
        }
        return new TreeAdapter(this.widgetContainerDisplayItem, undefined, undefined, true);
    }

    cutSelection() {
        this.treeAdapter!.cutSelection();
    }

    copySelection() {
        this.treeAdapter!.copySelection();
    }

    pasteSelection() {
        this.treeAdapter!.pasteSelection();
    }

    deleteSelection() {
        this.treeAdapter!.deleteSelection();
    }

    get selectedObject() {
        return this.selectedObjects[0];
    }

    get selectedObjects() {
        const selectedObjects =
            this.widgetContainerDisplayItem && this.widgetContainerDisplayItem.selectedObjects;
        if (selectedObjects && selectedObjects.length > 0) {
            return selectedObjects;
        }

        if (EditorsStore.activeEditor) {
            let pageTabState = EditorsStore.activeEditor.state as PageTabState;
            return [pageTabState.page];
        }

        return [];
    }

    @bind
    onFocus() {
        NavigationStore.setSelectedPanel(this);
    }

    render() {
        const navigation = (
            <Splitter
                type="vertical"
                persistId="page-editor/navigation-structure"
                sizes={`50%|50%`}
                childrenOverflow="hidden|hidden"
            >
                <ListNavigation id={this.props.id} navigationObject={this.props.navigationObject} />
                <Panel
                    id="page-structure"
                    title="Page Structure"
                    body={
                        this.treeAdapter ? (
                            <Tree
                                treeAdapter={this.treeAdapter}
                                tabIndex={0}
                                onFocus={this.onFocus}
                            />
                        ) : (
                            <div />
                        )
                    }
                />
            </Splitter>
        );

        const properties = (
            <Splitter
                type="vertical"
                persistId="page-editor/properties-widgets-palette"
                sizes={`100%|200px`}
                childrenOverflow="hidden|hidden"
            >
                <PropertiesPanel object={this.selectedObject} />
                <Panel id="widgets" title="Widgets Palette" body={<WidgetPalette />} />
            </Splitter>
        );

        return (
            <Splitter
                type="horizontal"
                persistId={`project-editor/pages`}
                sizes={`240px|100%|400px|240px`}
                childrenOverflow="hidden|hidden|hidden|hidden"
            >
                {navigation}
                <Editors />
                {properties}
                <ThemesSideView />
            </Splitter>
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

export class PageOrientation extends EezObject {
    @observable x: number;
    @observable y: number;
    @observable width: number;
    @observable height: number;
    @observable style?: string;
    @observable widgets: EezArrayObject<Widget>;

    static classInfo: ClassInfo = {
        properties: [
            {
                name: "x",
                type: PropertyType.Number,
                propertyGridGroup: geometryGroup
            },
            {
                name: "y",
                type: PropertyType.Number,
                propertyGridGroup: geometryGroup
            },
            {
                name: "width",
                type: PropertyType.Number,
                propertyGridGroup: geometryGroup
            },
            {
                name: "height",
                type: PropertyType.Number,
                propertyGridGroup: geometryGroup
            },
            {
                name: "style",
                type: PropertyType.ObjectReference,
                referencedObjectCollectionPath: ["gui", "styles"],
                propertyGridGroup: styleGroup
            },
            {
                name: "widgets",
                type: PropertyType.Array,
                typeClass: Widget,
                hideInPropertyGrid: true
            }
        ]
    };

    @computed
    get left() {
        return this.x;
    }

    @computed
    get top() {
        return this.y;
    }

    @computed
    get rect() {
        return {
            left: this.x,
            top: this.y,
            width: this.width,
            height: this.height
        };
    }

    @computed
    get closePageIfTouchedOutside() {
        return (this._parent as Page).closePageIfTouchedOutside;
    }
}

registerClass(PageOrientation);

////////////////////////////////////////////////////////////////////////////////

export class Page extends EezObject {
    @observable name: string;
    @observable description?: string;
    @observable style?: string;
    @observable widgets: EezArrayObject<Widget>;
    @observable usedIn: string[] | undefined;
    @observable closePageIfTouchedOutside: boolean;

    @observable left: number;
    @observable top: number;
    @observable width: number;
    @observable height: number;

    @observable portrait: PageOrientation;

    @observable isUsedAsCustomWidget: boolean;

    @observable dataContextOverrides: string;

    static classInfo: ClassInfo = {
        properties: [
            {
                name: "name",
                type: PropertyType.String,
                unique: true,
                propertyGridGroup: generalGroup
            },
            {
                name: "description",
                type: PropertyType.MultilineText,
                propertyGridGroup: generalGroup
            },
            {
                name: "dataContextOverrides",
                displayName: "Data context",
                type: PropertyType.JSON,
                propertyGridGroup: generalGroup
            },
            {
                name: "left",
                type: PropertyType.Number,
                propertyGridGroup: geometryGroup
            },
            {
                name: "top",
                type: PropertyType.Number,
                propertyGridGroup: geometryGroup
            },
            {
                name: "width",
                type: PropertyType.Number,
                propertyGridGroup: geometryGroup
            },
            {
                name: "height",
                type: PropertyType.Number,
                propertyGridGroup: geometryGroup
            },
            {
                name: "style",
                type: PropertyType.ObjectReference,
                referencedObjectCollectionPath: ["gui", "styles"],
                propertyGridGroup: styleGroup
            },
            {
                name: "widgets",
                type: PropertyType.Array,
                typeClass: Widget,
                hideInPropertyGrid: true
            },
            {
                name: "usedIn",
                type: PropertyType.ConfigurationReference,
                propertyGridGroup: generalGroup
            },
            {
                name: "closePageIfTouchedOutside",
                type: PropertyType.Boolean,
                propertyGridGroup: specificGroup
            },
            {
                name: "portrait",
                type: PropertyType.Object,
                typeClass: PageOrientation,
                isOptional: true,
                hideInPropertyGrid: true,
                enumerable: false
            },
            {
                name: "isUsedAsCustomWidget",
                type: PropertyType.Boolean,
                propertyGridGroup: generalGroup
            }
        ],
        beforeLoadHook: (page: Page, jsObject: any) => {
            if (jsObject.landscape) {
                Object.assign(jsObject, jsObject.landscape);
                delete jsObject.landscape;
            }

            if (jsObject["x"] !== undefined) {
                jsObject["left"] = jsObject["x"];
                delete jsObject["x"];
            }

            if (jsObject["y"] !== undefined) {
                jsObject["top"] = jsObject["y"];
                delete jsObject["y"];
            }

            if (!(ProjectStore.project && ProjectStore.project._allGuiPagesLoaded)) {
                lazyLoadPageWidgets.setPageWidgets(page, jsObject.widgets);
                jsObject.widgets = [];
            }
        },
        isPropertyMenuSupported: true,
        newItem: (parent: EezObject) => {
            return Promise.resolve({
                name: "Page",
                left: 0,
                top: 0,
                width: 480,
                height: 272,
                widgets: []
            });
        },
        createEditorState: (page: Page) => {
            // make sure widgets are loaded for this page to be ready for editor
            lazyLoadPageWidgets.prioritizePage(page);
            return new PageTabState(page);
        },
        navigationComponentId: "pages",
        findPastePlaceInside: (
            object: EezObject,
            classInfo: ClassInfo,
            isSingleObject: boolean
        ): EezObject | PropertyInfo | undefined => {
            if (object && isSubclassOf(classInfo, Widget.classInfo)) {
                return (object as Page).widgets;
            }
            return undefined;
        },
        editorComponent: PageEditor,
        navigationComponent: PagesNavigation,
        icon: "filter_none"
    };

    @computed
    get rect() {
        return {
            left: this.left,
            top: this.top,
            width: this.width,
            height: this.height
        };
    }

    getResizeHandlers(): IResizeHandler[] | undefined | false {
        return [
            {
                x: 100,
                y: 50,
                type: "e-resize"
            },
            {
                x: 50,
                y: 100,
                type: "s-resize"
            },
            {
                x: 100,
                y: 100,
                type: "se-resize"
            }
        ];
    }

    @computed
    get dataContextOverridesObject() {
        try {
            return JSON.parse(this.dataContextOverrides);
        } catch {
            return undefined;
        }
    }

    check() {
        let messages: output.Message[] = [];

        if (this.dataContextOverrides) {
            try {
                JSON.parse(this.dataContextOverrides);
            } catch {
                messages.push(output.propertyInvalidValueMessage(this, "dataContextOverrides"));
            }
        }

        return messages;
    }

    render(rect: Rect, dataContext: DataContext) {
        return (
            <WidgetContainerComponent
                containerWidget={this}
                widgets={asArray(this.widgets)}
                dataContext={new DataContext(dataContext, this.dataContextOverridesObject)}
            />
        );
    }

    styleHook(style: React.CSSProperties, designerContext: IDesignerContext | undefined) {
        const pageStyle = findStyle(this.style || "default");
        if (pageStyle && pageStyle.backgroundColorProperty) {
            style.backgroundColor = to16bitsColor(
                getThemedColor(pageStyle.backgroundColorProperty)
            );
        } else {
            console.log(this.style, pageStyle);
        }
    }
}

registerClass(Page);
