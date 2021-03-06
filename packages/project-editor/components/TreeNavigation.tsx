import React from "react";
import { observer } from "mobx-react";
import { bind } from "bind-decorator";

import { IconAction } from "eez-studio-ui/action";

import { EezObject, objectToString } from "project-editor/core/object";
import { EditorsStore, NavigationStore, addItem, canAdd } from "project-editor/core/store";
import {
    TreeObjectAdapter,
    ITreeObjectAdapter,
    TreeAdapter
} from "project-editor/core/objectAdapter";

import { Panel } from "project-editor/components/Panel";
import { Tree } from "project-editor/components/Tree";

////////////////////////////////////////////////////////////////////////////////

@observer
class AddButton extends React.Component<
    {
        objectAdapter: ITreeObjectAdapter;
    },
    {}
> {
    async onAdd() {
        if (this.props.objectAdapter.selectedObject) {
            const aNewItem = await addItem(this.props.objectAdapter.selectedObject);
            if (aNewItem) {
                this.props.objectAdapter.selectObject(aNewItem);
            }
        }
    }

    render() {
        return (
            <IconAction
                title="Add Item"
                icon="material:add"
                iconSize={16}
                onClick={this.onAdd.bind(this)}
                enabled={
                    this.props.objectAdapter.selectedObject &&
                    canAdd(this.props.objectAdapter.selectedObject)
                }
            />
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

@observer
class DeleteButton extends React.Component<
    {
        objectAdapter: ITreeObjectAdapter;
    },
    {}
> {
    onDelete() {
        this.props.objectAdapter.deleteSelection();
    }

    render() {
        return (
            <IconAction
                title="Delete Selected Item"
                icon="material:delete"
                iconSize={16}
                onClick={this.onDelete.bind(this)}
                enabled={this.props.objectAdapter.canDelete()}
            />
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

interface TreeNavigationPanelProps {
    navigationObject: EezObject;
}

@observer
export class TreeNavigationPanel extends React.Component<TreeNavigationPanelProps, {}> {
    static navigationTreeFilter(object: EezObject) {
        const classInfo = object._classInfo;
        return (
            classInfo.showInNavigation ||
            !!classInfo.navigationComponent ||
            !!classInfo.editorComponent
        );
    }

    @bind
    onTreeDoubleClick(object: EezObject) {
        if (EditorsStore.activeEditor && EditorsStore.activeEditor.object == object) {
            EditorsStore.activeEditor.makePermanent();
        }
    }

    onFocus() {
        NavigationStore.setSelectedPanel(undefined);
    }

    render() {
        let navigationObjectAdapter = NavigationStore.getNavigationSelectedItemAsObjectAdapter(
            this.props.navigationObject
        );

        if (!navigationObjectAdapter) {
            const newNavigationObjectAdapter = new TreeObjectAdapter(this.props.navigationObject);

            setTimeout(() => {
                NavigationStore.setNavigationSelectedItem(
                    this.props.navigationObject,
                    newNavigationObjectAdapter
                );
            }, 0);

            navigationObjectAdapter = newNavigationObjectAdapter;
        }

        let objectAdapter = navigationObjectAdapter.getObjectAdapter(this.props.navigationObject);
        if (!objectAdapter) {
            return null;
        }

        return (
            <Panel
                id="navigation"
                title={objectToString(this.props.navigationObject)}
                buttons={[
                    <AddButton key="add" objectAdapter={navigationObjectAdapter} />,
                    <DeleteButton key="delete" objectAdapter={navigationObjectAdapter} />
                ]}
                body={
                    <Tree
                        treeAdapter={
                            new TreeAdapter(
                                navigationObjectAdapter,
                                objectAdapter,
                                TreeNavigationPanel.navigationTreeFilter,
                                true,
                                "none",
                                undefined,
                                this.onTreeDoubleClick
                            )
                        }
                        tabIndex={0}
                        onFocus={this.onFocus.bind(this)}
                    />
                }
            />
        );
    }
}
